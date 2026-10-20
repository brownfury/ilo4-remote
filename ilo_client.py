import os
import time
import json
import logging
import urllib3
import requests
import hpilo

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logger = logging.getLogger("ilo_client")

class ILO4Client:
    def __init__(self, host: str, user: str, password: str, ssl_verify: bool = False, timeout: int = 10):
        self.host = host.strip()
        self.user = user.strip()
        self.password = password
        self.ssl_verify = ssl_verify
        self.timeout = timeout
        
        self.base_url = f"https://{self.host}"
        self.session = requests.Session()
        self.session.verify = self.ssl_verify
        
        self.token = None
        self.token_expiry = 0
        self._hpilo_instance = None
        self._cached_resource_dir = None

    def get_hpilo(self) -> hpilo.Ilo:
        """Returns or instantiates a python-hpilo Ilo instance."""
        if not self._hpilo_instance:
            self._hpilo_instance = hpilo.Ilo(
                self.host,
                login=self.user,
                password=self.password,
                timeout=self.timeout
            )
        return self._hpilo_instance

    def update_credentials(self, host: str = None, user: str = None, password: str = None):
        if host:
            self.host = host.strip()
            self.base_url = f"https://{self.host}"
        if user:
            self.user = user.strip()
        if password is not None:
            self.password = password
            
        self.token = None
        self.token_expiry = 0
        self._hpilo_instance = None
        self._cached_resource_dir = None

    def login_rest(self, force: bool = False) -> str:
        """Authenticates with iLO 4 RESTful API and caches the X-Auth-Token."""
        now = time.time()
        if self.token and not force and (self.token_expiry - now > 60):
            return self.token
            
        url = f"{self.base_url}/rest/v1/SessionService/Sessions"
        payload = {"UserName": self.user, "Password": self.password}
        
        try:
            res = self.session.post(url, json=payload, timeout=self.timeout)
            if res.status_code in [200, 201]:
                token = res.headers.get("X-Auth-Token") or res.headers.get("x-auth-token")
                if token:
                    self.token = token
                    self.token_expiry = now + 900  # 15 minutes validity
                    return self.token
            raise RuntimeError(f"REST login failed with HTTP {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"Failed to authenticate with iLO REST API: {e}")
            raise

    def rest_request(self, method: str, path: str, json_data: dict = None, custom_headers: dict = None) -> requests.Response:
        """Executes an authenticated REST request against iLO 4."""
        token = self.login_rest()
        
        # Ensure path starts with /
        if not path.startswith("/"):
            path = "/" + path
            
        # Ensure /rest/v1 prefix if not present
        if not path.startswith("/rest/v1") and not path.startswith("/redfish/v1"):
            path = "/rest/v1" + path

        url = f"{self.base_url}{path}"
        headers = {
            "X-Auth-Token": token,
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        if custom_headers:
            headers.update(custom_headers)

        res = self.session.request(
            method=method.upper(),
            url=url,
            headers=headers,
            json=json_data,
            timeout=self.timeout
        )

        # Handle token expiration (HTTP 401)
        if res.status_code == 401:
            token = self.login_rest(force=True)
            headers["X-Auth-Token"] = token
            res = self.session.request(
                method=method.upper(),
                url=url,
                headers=headers,
                json=json_data,
                timeout=self.timeout
            )

        return res

    def get_power_status(self) -> dict:
        """Gets current power status from both REST and RIBCL for redundancy."""
        result = {
            "power_state": "Unknown",
            "source": "None",
            "details": {}
        }
        # Try REST first
        try:
            res = self.rest_request("GET", "/rest/v1/Systems/1")
            if res.status_code == 200:
                data = res.json()
                result["power_state"] = data.get("PowerState", "Unknown")
                result["source"] = "REST"
                result["details"] = {
                    "model": data.get("Model"),
                    "status": data.get("Status"),
                    "indicator_led": data.get("IndicatorLED")
                }
                return result
        except Exception as rest_err:
            logger.warning(f"REST power check failed: {rest_err}")

        # Fallback to RIBCL
        try:
            ilo = self.get_hpilo()
            pwr = ilo.get_host_power_status()
            result["power_state"] = "On" if pwr.upper() == "ON" else "Off"
            result["source"] = "RIBCL"
            return result
        except Exception as ribcl_err:
            logger.error(f"RIBCL power check failed: {ribcl_err}")
            raise RuntimeError(f"Unable to query power status: {ribcl_err}")

    def set_power_state(self, action: str) -> dict:
        """
        Executes a power state change.
        Supported actions:
        - 'on': Turn system On
        - 'force_off': Immediate hard power off
        - 'graceful_shutdown' or 'off': Push power button (graceful OS shutdown)
        - 'reset' or 'force_restart': Force Reboot
        - 'push_power_button': Momentary press
        - 'warm_boot': RIBCL warm boot
        - 'cold_boot': RIBCL cold boot
        """
        action = action.lower().strip()
        
        # REST mapping
        rest_action_map = {
            "on": "On",
            "force_off": "ForceOff",
            "off": "PushPowerButton",
            "graceful_shutdown": "PushPowerButton",
            "reset": "ForceRestart",
            "force_restart": "ForceRestart",
            "push_power_button": "PushPowerButton",
            "nmi": "Nmi"
        }

        # First attempt via REST
        if action in rest_action_map:
            reset_type = rest_action_map[action]
            payload = {
                "Action": "Reset",
                "ResetType": reset_type
            }
            try:
                res = self.rest_request("POST", "/rest/v1/Systems/1", json_data=payload)
                if res.status_code in [200, 201, 202, 204]:
                    return {
                        "status": "success",
                        "method": "REST",
                        "action": action,
                        "reset_type": reset_type,
                        "http_status": res.status_code,
                        "message": f"Power action '{action}' ({reset_type}) issued successfully via REST."
                    }
            except Exception as e:
                logger.warning(f"REST power action '{action}' failed, falling back to RIBCL: {e}")

        # Fallback / Direct execution via python-hpilo (RIBCL)
        ilo = self.get_hpilo()
        if action == "on":
            ilo.set_host_power(host_power=True)
            msg = "Power ON command issued via RIBCL."
        elif action == "force_off":
            ilo.set_host_power(host_power=False)
            msg = "Power OFF (Force) command issued via RIBCL."
        elif action in ["off", "graceful_shutdown", "push_power_button"]:
            ilo.press_pwr_btn()
            msg = "Virtual Power Button pressed via RIBCL."
        elif action in ["reset", "cold_boot"]:
            ilo.cold_boot_server()
            msg = "Cold Boot command issued via RIBCL."
        elif action == "warm_boot":
            ilo.warm_boot_server()
            msg = "Warm Boot command issued via RIBCL."
        else:
            raise ValueError(f"Unknown power action '{action}'")

        return {
            "status": "success",
            "method": "RIBCL",
            "action": action,
            "message": msg
        }

    def get_uid_status(self) -> dict:
        """Gets Unit Identification LED status."""
        try:
            ilo = self.get_hpilo()
            status = ilo.get_uid_status()
            return {"uid_status": status}
        except Exception:
            # Fallback to REST Systems/1
            res = self.rest_request("GET", "/rest/v1/Systems/1")
            if res.status_code == 200:
                data = res.json()
                return {"uid_status": data.get("IndicatorLED", "Unknown")}
            return {"uid_status": "Unknown"}

    def set_uid_status(self, state: str) -> dict:
        """Toggles or sets the UID LED (On / Off)."""
        ilo = self.get_hpilo()
        state_bool = True if state.lower() in ["on", "true", "1"] else False
        ilo.set_uid_status(uid_status=state_bool)
        return {"status": "success", "uid_status": "ON" if state_bool else "OFF"}

    def get_system_summary(self) -> dict:
        """Gets comprehensive hardware information."""
        res_sys = self.rest_request("GET", "/rest/v1/Systems/1")
        res_chassis = self.rest_request("GET", "/rest/v1/Chassis/1")
        res_manager = self.rest_request("GET", "/rest/v1/Managers/1")
        
        sys_data = res_sys.json() if res_sys.status_code == 200 else {}
        chassis_data = res_chassis.json() if res_chassis.status_code == 200 else {}
        manager_data = res_manager.json() if res_manager.status_code == 200 else {}
        
        return {
            "system": {
                "model": sys_data.get("Model"),
                "manufacturer": sys_data.get("Manufacturer"),
                "serial_number": sys_data.get("SerialNumber"),
                "uuid": sys_data.get("UUID"),
                "sku": sys_data.get("SKU"),
                "bios_version": sys_data.get("BiosVersion"),
                "power_state": sys_data.get("PowerState"),
                "status": sys_data.get("Status", {}),
                "processor_summary": sys_data.get("ProcessorSummary", {}),
                "memory_summary": sys_data.get("MemorySummary", {}),
                "indicator_led": sys_data.get("IndicatorLED")
            },
            "chassis": {
                "model": chassis_data.get("Model"),
                "serial_number": chassis_data.get("SerialNumber"),
                "status": chassis_data.get("Status", {})
            },
            "manager": {
                "firmware_version": manager_data.get("FirmwareVersion"),
                "manager_type": manager_data.get("ManagerType"),
                "model": manager_data.get("Model"),
                "status": manager_data.get("Status", {})
            }
        }

    def get_thermal_sensors(self) -> dict:
        """Retrieves Sea of Sensors temperatures and fans."""
        res = self.rest_request("GET", "/rest/v1/Chassis/1/Thermal")
        if res.status_code != 200:
            raise RuntimeError(f"Failed to fetch thermal sensors: {res.status_code}")
        data = res.json()
        return {
            "temperatures": data.get("Temperatures", []),
            "fans": data.get("Fans", [])
        }

    def get_power_supplies(self) -> dict:
        """Retrieves power supplies and power meters."""
        res = self.rest_request("GET", "/rest/v1/Chassis/1/Power")
        if res.status_code != 200:
            raise RuntimeError(f"Failed to fetch power supplies: {res.status_code}")
        data = res.json()
        return {
            "power_supplies": data.get("PowerSupplies", []),
            "power_control": data.get("PowerControl", [])
        }

    def get_event_logs(self, log_type: str = "iml") -> list:
        """
        Retrieves logs:
        - 'iml': Integrated Management Log
        - 'iel': iLO Event Log
        """
        if log_type.lower() == "iml":
            path = "/rest/v1/Systems/1/LogServices/IML/Entries"
        else:
            path = "/rest/v1/Managers/1/LogServices/IEL/Entries"

        res = self.rest_request("GET", path)
        if res.status_code == 200:
            data = res.json()
            return data.get("Items", [])
        return []

    def get_resource_directory(self) -> list:
        """Discovers all available REST endpoints from /rest/v1/ResourceDirectory."""
        if self._cached_resource_dir:
            return self._cached_resource_dir

        res = self.rest_request("GET", "/rest/v1/ResourceDirectory")
        if res.status_code == 200:
            data = res.json()
            instances = data.get("Instances", [])
            formatted = []
            for item in instances:
                href = item.get("href")
                odata_id = item.get("@odata.id")
                target_url = href or odata_id
                if target_url:
                    formatted.append({
                        "href": target_url,
                        "type": item.get("@odata.type") or item.get("Type", ""),
                        "methods": item.get("HttpMethods", ["GET"]),
                        "etag": item.get("ETag", "")
                    })
            self._cached_resource_dir = formatted
            return formatted
        return []

    def get_ribcl_methods(self) -> list:
        """Discovers all available methods on hpilo.Ilo."""
        ilo = self.get_hpilo()
        methods = []
        for name in dir(ilo):
            if name.startswith("_") or name.isupper():
                continue
            attr = getattr(ilo, name, None)
            if callable(attr):
                doc = (attr.__doc__ or "").strip()
                methods.append({
                    "name": name,
                    "doc": doc
                })
        return sorted(methods, key=lambda x: x["name"])

    def execute_ribcl_method(self, method_name: str, kwargs: dict = None) -> dict:
        """Dynamically invokes any native python-hpilo RIBCL method."""
        ilo = self.get_hpilo()
        if not hasattr(ilo, method_name):
            raise AttributeError(f"Method '{method_name}' does not exist on hpilo.Ilo")
            
        attr = getattr(ilo, method_name)
        if not callable(attr):
            raise TypeError(f"'{method_name}' is not callable")

        kwargs = kwargs or {}
        start_time = time.time()
        result = attr(**kwargs)
        elapsed = time.time() - start_time

        return {
            "method": method_name,
            "status": "success",
            "execution_time_ms": round(elapsed * 1000, 2),
            "result": result
        }
