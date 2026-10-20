import os
import time
import socket
import logging
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from config import settings
from ilo_client import ILO4Client

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ilo_app")

app = FastAPI(title="HP iLO 4 Command Center", version="1.0.0")

# Mount static files and templates
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)
os.makedirs("templates", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Initialize global iLO client
ilo_client = ILO4Client(
    host=settings.ILO_HOST,
    user=settings.ILO_USER,
    password=settings.ILO_PASSWORD,
    ssl_verify=settings.ILO_SSL_VERIFY,
    timeout=settings.ILO_TIMEOUT
)

def get_lan_ip():
    """Detects primary LAN IP for displaying home network access URL."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        # Does not need to be reachable
        s.connect(('192.168.8.1', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"

# Request Models
class PowerActionRequest(BaseModel):
    action: str  # on, force_off, off, reset, warm_boot, cold_boot, push_power_button

class UIDRequest(BaseModel):
    state: str  # on, off

class RestProxyRequest(BaseModel):
    method: str = "GET"
    path: str
    body: Optional[Any] = None
    headers: Optional[Dict[str, str]] = None

class RibclExecuteRequest(BaseModel):
    method_name: str
    kwargs: Optional[Dict[str, Any]] = None

class ConfigUpdateRequest(BaseModel):
    host: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None
    ssl_verify: Optional[bool] = None
    timeout: Optional[int] = None

# Routes
@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
async def serve_dashboard(request: Request):
    lan_ip = get_lan_ip()
    return templates.TemplateResponse("index.html", {
        "request": request,
        "ilo_host": ilo_client.host,
        "lan_ip": lan_ip,
        "lan_port": settings.SERVER_PORT
    })

@app.get("/api/status")
async def get_connection_status():
    """Quick health & ping check to iLO 4."""
    lan_ip = get_lan_ip()
    start = time.time()
    try:
        pwr_data = ilo_client.get_power_status()
        latency = round((time.time() - start) * 1000, 1)
        return {
            "status": "connected",
            "latency_ms": latency,
            "host": ilo_client.host,
            "user": ilo_client.user,
            "power_state": pwr_data.get("power_state"),
            "lan_url": f"http://{lan_ip}:{settings.SERVER_PORT}",
            "lan_ip": lan_ip
        }
    except Exception as e:
        latency = round((time.time() - start) * 1000, 1)
        return {
            "status": "error",
            "latency_ms": latency,
            "host": ilo_client.host,
            "user": ilo_client.user,
            "error": str(e),
            "lan_url": f"http://{lan_ip}:{settings.SERVER_PORT}",
            "lan_ip": lan_ip
        }

@app.get("/api/power/status")
async def get_power_status():
    """Returns current host power status and UID LED state."""
    try:
        pwr = ilo_client.get_power_status()
        uid = ilo_client.get_uid_status()
        return {
            "status": "success",
            "power_state": pwr.get("power_state"),
            "source": pwr.get("source"),
            "uid_status": uid.get("uid_status"),
            "details": pwr.get("details")
        }
    except Exception as e:
        logger.error(f"Error fetching power status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/power/action")
async def execute_power_action(req: PowerActionRequest):
    """Executes a power state change (on, off, force_off, reset, etc.)."""
    try:
        result = ilo_client.set_power_state(req.action)
        # Short pause to let iLO register state change
        time.sleep(0.5)
        new_status = ilo_client.get_power_status()
        result["new_power_state"] = new_status.get("power_state")
        return result
    except Exception as e:
        logger.error(f"Error executing power action '{req.action}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/uid/status")
async def get_uid_status():
    """Gets UID LED state."""
    try:
        return ilo_client.get_uid_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/uid/toggle")
async def toggle_uid(req: UIDRequest):
    """Turns the UID LED on or off."""
    try:
        return ilo_client.set_uid_status(req.state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system/summary")
async def get_system_summary():
    """Returns full hardware summary (ML350 Gen9, dual Xeon, 112GB RAM, BIOS, serial)."""
    try:
        return ilo_client.get_system_summary()
    except Exception as e:
        logger.error(f"Error fetching system summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system/thermal")
async def get_thermal_data():
    """Returns all 46 Sea of Sensors temperatures and 8 fans."""
    try:
        return ilo_client.get_thermal_sensors()
    except Exception as e:
        logger.error(f"Error fetching thermal sensors: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system/power")
async def get_power_supplies():
    """Returns power supplies and power meters."""
    try:
        return ilo_client.get_power_supplies()
    except Exception as e:
        logger.error(f"Error fetching power supplies: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs/iml")
async def get_iml_logs():
    """Returns Integrated Management Log entries."""
    try:
        entries = ilo_client.get_event_logs(log_type="iml")
        return {"count": len(entries), "entries": entries}
    except Exception as e:
        logger.error(f"Error fetching IML logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs/iel")
async def get_iel_logs():
    """Returns iLO Event Log entries."""
    try:
        entries = ilo_client.get_event_logs(log_type="iel")
        return {"count": len(entries), "entries": entries}
    except Exception as e:
        logger.error(f"Error fetching IEL logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rest/endpoints")
async def get_rest_endpoints():
    """Returns all 121+ discovered REST endpoints from ResourceDirectory."""
    try:
        endpoints = ilo_client.get_resource_directory()
        return {"count": len(endpoints), "endpoints": endpoints}
    except Exception as e:
        logger.error(f"Error discovering REST endpoints: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/rest/proxy")
async def proxy_rest_request(req: RestProxyRequest):
    """
    Executes ANY arbitrary REST call to the HP iLO 4 server.
    Returns HTTP status, response time, response headers, and parsed payload.
    """
    start_time = time.time()
    try:
        res = ilo_client.rest_request(
            method=req.method,
            path=req.path,
            json_data=req.body,
            custom_headers=req.headers
        )
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        
        # Try parsing JSON response
        try:
            res_json = res.json()
        except Exception:
            res_json = None
            
        return {
            "status": "success",
            "http_status": res.status_code,
            "status_text": res.reason,
            "execution_time_ms": elapsed_ms,
            "headers": dict(res.headers),
            "data": res_json,
            "raw_text": res.text if res_json is None else None
        }
    except Exception as e:
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Proxy request failed: {e}")
        return {
            "status": "error",
            "execution_time_ms": elapsed_ms,
            "error": str(e)
        }

@app.get("/api/ribcl/methods")
async def get_ribcl_methods():
    """Returns list of all 160+ native python-hpilo RIBCL methods."""
    try:
        methods = ilo_client.get_ribcl_methods()
        return {"count": len(methods), "methods": methods}
    except Exception as e:
        logger.error(f"Error listing RIBCL methods: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ribcl/execute")
async def execute_ribcl_method(req: RibclExecuteRequest):
    """Executes ANY native python-hpilo RIBCL method."""
    try:
        result = ilo_client.execute_ribcl_method(req.method_name, req.kwargs)
        return result
    except Exception as e:
        logger.error(f"Error executing RIBCL method '{req.method_name}': {e}")
        return {
            "status": "error",
            "method": req.method_name,
            "error": str(e)
        }

@app.get("/api/config")
async def get_config():
    """Returns active settings (password masked)."""
    lan_ip = get_lan_ip()
    return {
        "host": ilo_client.host,
        "user": ilo_client.user,
        "ssl_verify": ilo_client.ssl_verify,
        "timeout": ilo_client.timeout,
        "lan_ip": lan_ip,
        "lan_url": f"http://{lan_ip}:{settings.SERVER_PORT}"
    }

@app.post("/api/config")
async def update_config(req: ConfigUpdateRequest):
    """Updates iLO credentials/host at runtime."""
    try:
        ilo_client.update_credentials(
            host=req.host,
            user=req.user,
            password=req.password
        )
        if req.ssl_verify is not None:
            ilo_client.ssl_verify = req.ssl_verify
            ilo_client.session.verify = req.ssl_verify
        if req.timeout is not None:
            ilo_client.timeout = req.timeout

        # Test login
        ilo_client.login_rest(force=True)
        return {"status": "success", "message": "Configuration updated and connection verified successfully!"}
    except Exception as e:
        return {"status": "error", "error": f"Configuration updated but test connection failed: {e}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=settings.SERVER_PORT, reload=False)
