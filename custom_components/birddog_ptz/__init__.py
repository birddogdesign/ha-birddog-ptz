"""BirdDog PTZ Camera Integration for Home Assistant."""
import asyncio
import logging

import voluptuous as vol

from homeassistant.const import CONF_HOST, CONF_PORT, CONF_NAME
from homeassistant.core import HomeAssistant, ServiceCall
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers.typing import ConfigType

_LOGGER = logging.getLogger(__name__)

DOMAIN = "birddog_ptz"
DEFAULT_PORT = 52381

CONFIG_SCHEMA = vol.Schema({DOMAIN: vol.Schema({})}, extra=vol.ALLOW_EXTRA)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the BirdDog PTZ component."""
    hass.data[DOMAIN] = {}
    hass.data[DOMAIN]["cameras"] = {}
    
    def get_camera(host: str, port: int) -> "BirdDogCamera":
        """Get or create a camera instance."""
        key = f"{host}:{port}"
        if key not in hass.data[DOMAIN]["cameras"]:
            hass.data[DOMAIN]["cameras"][key] = BirdDogCamera(host, port)
        return hass.data[DOMAIN]["cameras"][key]
    
    async def handle_pan_tilt(call: ServiceCall) -> None:
        """Handle pan/tilt service call."""
        host = call.data.get("host")
        port = call.data.get("port", DEFAULT_PORT)
        pan = call.data.get("pan", 0)
        tilt = call.data.get("tilt", 0)
        camera = get_camera(host, port)
        await camera.pan_tilt(pan, tilt)

    async def handle_stop(call: ServiceCall) -> None:
        """Handle stop service call."""
        host = call.data.get("host")
        port = call.data.get("port", DEFAULT_PORT)
        camera = get_camera(host, port)
        await camera.stop()

    async def handle_zoom_in(call: ServiceCall) -> None:
        """Handle zoom in service call."""
        host = call.data.get("host")
        port = call.data.get("port", DEFAULT_PORT)
        speed = call.data.get("speed", 5)
        camera = get_camera(host, port)
        await camera.zoom_in(speed)

    async def handle_zoom_out(call: ServiceCall) -> None:
        """Handle zoom out service call."""
        host = call.data.get("host")
        port = call.data.get("port", DEFAULT_PORT)
        speed = call.data.get("speed", 5)
        camera = get_camera(host, port)
        await camera.zoom_out(speed)

    async def handle_zoom_stop(call: ServiceCall) -> None:
        """Handle zoom stop service call."""
        host = call.data.get("host")
        port = call.data.get("port", DEFAULT_PORT)
        camera = get_camera(host, port)
        await camera.zoom_stop()

    async def handle_focus_near(call: ServiceCall) -> None:
        """Handle focus near service call."""
        host = call.data.get("host")
        port = call.data.get("port", DEFAULT_PORT)
        speed = call.data.get("speed", 5)
        camera = get_camera(host, port)
        await camera.focus_near(speed)

    async def handle_focus_far(call: ServiceCall) -> None:
        """Handle focus far service call."""
        host = call.data.get("host")
        port = call.data.get("port", DEFAULT_PORT)
        speed = call.data.get("speed", 5)
        camera = get_camera(host, port)
        await camera.focus_far(speed)

    async def handle_focus_stop(call: ServiceCall) -> None:
        """Handle focus stop service call."""
        host = call.data.get("host")
        port = call.data.get("port", DEFAULT_PORT)
        camera = get_camera(host, port)
        await camera.focus_stop()

    hass.services.async_register(DOMAIN, "pan_tilt", handle_pan_tilt)
    hass.services.async_register(DOMAIN, "stop", handle_stop)
    hass.services.async_register(DOMAIN, "zoom_in", handle_zoom_in)
    hass.services.async_register(DOMAIN, "zoom_out", handle_zoom_out)
    hass.services.async_register(DOMAIN, "zoom_in_stop", handle_zoom_stop)
    hass.services.async_register(DOMAIN, "zoom_out_stop", handle_zoom_stop)
    hass.services.async_register(DOMAIN, "focus_near", handle_focus_near)
    hass.services.async_register(DOMAIN, "focus_far", handle_focus_far)
    hass.services.async_register(DOMAIN, "focus_near_stop", handle_focus_stop)
    hass.services.async_register(DOMAIN, "focus_far_stop", handle_focus_stop)

    _LOGGER.info("BirdDog PTZ integration loaded successfully")
    return True


class BirdDogCamera:
    """BirdDog Camera VISCA controller."""

    def __init__(self, host: str, port: int):
        """Initialize the camera controller."""
        self.host = host
        self.port = port
        self._reader = None
        self._writer = None
        self._lock = asyncio.Lock()

    async def _ensure_connection(self) -> bool:
        """Ensure we have an active connection."""
        if self._writer is None or self._writer.is_closing():
            try:
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port),
                    timeout=5.0
                )
                _LOGGER.info("Connected to BirdDog camera at %s:%s", self.host, self.port)
                return True
            except Exception as err:
                _LOGGER.error("Failed to connect to camera at %s:%s - %s", self.host, self.port, err)
                return False
        return True

    async def _send_command(self, command: bytes) -> bool:
        """Send a VISCA command to the camera."""
        async with self._lock:
            if not await self._ensure_connection():
                return False

            try:
                self._writer.write(command)
                await self._writer.drain()
                
                try:
                    response = await asyncio.wait_for(
                        self._reader.read(16),
                        timeout=0.5
                    )
                    _LOGGER.debug("Response: %s", response.hex())
                except asyncio.TimeoutError:
                    pass
                
                return True
            except Exception as err:
                _LOGGER.error("Failed to send command: %s", err)
                if self._writer:
                    self._writer.close()
                    await self._writer.wait_closed()
                    self._writer = None
                return False

    def _map_speed(self, value: int, max_visca_speed: int = 0x18) -> int:
        """Map -100 to 100 range to VISCA speed."""
        abs_value = abs(value)
        if abs_value < 5:
            return 0
        speed = int((abs_value / 100.0) * max_visca_speed)
        return max(1, min(speed, max_visca_speed))

    async def pan_tilt(self, pan: int, tilt: int) -> None:
        """Pan and tilt the camera."""
        pan_speed = self._map_speed(pan)
        tilt_speed = self._map_speed(tilt)

        if pan_speed == 0 and tilt_speed == 0:
            await self.stop()
            return

        if pan > 0:
            pan_dir = 0x02
        elif pan < 0:
            pan_dir = 0x01
        else:
            pan_dir = 0x03

        if tilt > 0:
            tilt_dir = 0x01
        elif tilt < 0:
            tilt_dir = 0x02
        else:
            tilt_dir = 0x03

        command = bytes([
            0x81, 0x01, 0x06, 0x01,
            pan_speed, tilt_speed,
            pan_dir, tilt_dir,
            0xFF
        ])
        await self._send_command(command)

    async def stop(self) -> None:
        """Stop all movement."""
        command = bytes([0x81, 0x01, 0x06, 0x01, 0x01, 0x01, 0x03, 0x03, 0xFF])
        await self._send_command(command)

    async def zoom_in(self, speed: int = 5) -> None:
        """Start zooming in."""
        speed = max(0, min(7, speed))
        command = bytes([0x81, 0x01, 0x04, 0x07, 0x20 | speed, 0xFF])
        await self._send_command(command)

    async def zoom_out(self, speed: int = 5) -> None:
        """Start zooming out."""
        speed = max(0, min(7, speed))
        command = bytes([0x81, 0x01, 0x04, 0x07, 0x30 | speed, 0xFF])
        await self._send_command(command)

    async def zoom_stop(self) -> None:
        """Stop zoom."""
        command = bytes([0x81, 0x01, 0x04, 0x07, 0x00, 0xFF])
        await self._send_command(command)

    async def focus_near(self, speed: int = 5) -> None:
        """Start focusing near."""
        speed = max(0, min(7, speed))
        command = bytes([0x81, 0x01, 0x04, 0x08, 0x30 | speed, 0xFF])
        await self._send_command(command)

    async def focus_far(self, speed: int = 5) -> None:
        """Start focusing far."""
        speed = max(0, min(7, speed))
        command = bytes([0x81, 0x01, 0x04, 0x08, 0x20 | speed, 0xFF])
        await self._send_command(command)

    async def focus_stop(self) -> None:
        """Stop focus."""
        command = bytes([0x81, 0x01, 0x04, 0x08, 0x00, 0xFF])
        await self._send_command(command)