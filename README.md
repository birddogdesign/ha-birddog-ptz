# BirdDog PTZ Control for Home Assistant

Interactive joystick control for BirdDog cameras via VISCA protocol.

## Features

- 🕹️ **Smooth joystick control** with directional lock and speed scaling
- 🎯 **Directional button mode** - 8-way directional controls as alternative to joystick
- 🔍 **Zoom & Focus controls** with adjustable speeds (1-7)
- ⚙️ **Speed settings** for Pan/Tilt/Zoom/Focus
- 🎨 **Full theme support** - respects all Home Assistant themes
- 🎨 **Custom colors** - Override theme with custom hex colors
- 📝 **Visual editor** - configure camera IP and display options directly in the UI
- 🔌 **No entity required** - services work directly with camera IP
- 📱 **Responsive design** - works on mobile, tablet, and desktop
- ⚡ **Compact mode** - hide speed controls, zoom/focus buttons, or joystick for minimal layouts

## Supported Cameras

**BirdDog X Series:**
- X1
- X1 Ultra
- X4
- X5
- XL

**BirdDog O Series:**
- O4

**BirdDog Other Models:**
- MAX Series
- MAKI Series

All models supporting VISCA over IP on port 52381.

## Installation

### Manual Installation

1. Copy `custom_components/birddog_ptz` to your Home Assistant `config/custom_components/` directory
2. Copy `www/birddog-ptz-card.js` to your `config/www/` directory
3. Add to `configuration.yaml`:
   ```yaml
   birddog_ptz:
   ```
4. Restart Home Assistant
5. Add Lovelace resource:
   - Go to Settings → Dashboards → Resources
   - Add Resource: `/local/birddog-ptz-card.js` (JavaScript Module)
6. Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)

### File Structure

```
config/
├── custom_components/
│   └── birddog_ptz/
│       ├── __init__.py
│       ├── manifest.json
│       └── services.yaml
└── www/
    └── birddog-ptz-card.js
```

## Usage

### Add Card to Dashboard

1. Edit your dashboard
2. Click "Add Card"
3. Search for "BirdDog PTZ Control"
4. Configure:
   - **Camera Name**: Display name
   - **Camera IP Address**: Your BirdDog camera IP (e.g., 192.168.1.100)
   - **VISCA Port**: Default is 52381
   - **Display Options**:
     - Show Joystick (uncheck for directional buttons)
     - Show Speed Controls
     - Show Zoom/Focus Buttons
   - **Color Settings**:
     - Use Theme Colors (default)
     - Custom Joystick Color
     - Custom Button Color

### Card Configuration Examples

**Full Featured Card:**
```yaml
type: custom:birddog-ptz-card
host: 192.168.1.100
port: 52381
name: Studio Camera
show_joystick: true
show_speed_controls: true
show_zoom_focus: true
use_theme_colors: true
```

**Compact Card (Directional Buttons Only):**
```yaml
type: custom:birddog-ptz-card
host: 192.168.1.100
name: Camera 2
show_joystick: false
show_speed_controls: false
show_zoom_focus: false
```

**Custom Colors:**
```yaml
type: custom:birddog-ptz-card
host: 192.168.1.100
name: Broadcast Camera
use_theme_colors: false
joystick_color: "#FF5733"
button_color: "#3498DB"
```

### Using Services

All PTZ functions are available as services for automation:

```yaml
service: birddog_ptz.pan_tilt
data:
  host: 192.168.1.100
  port: 52381
  pan: 50    # -100 to 100 (left/right)
  tilt: -30  # -100 to 100 (down/up)
```

```yaml
service: birddog_ptz.zoom_in
data:
  host: 192.168.1.100
  speed: 7  # 0-7
```

## Technical Details

- **Protocol**: VISCA over TCP/IP
- **Port**: 52381 (BirdDog default)
- **Update Rate**: 100ms for smooth real-time control
- **Directional Locking**: Prevents accidental perpendicular movement
- **Dead Zone**: 10px wiggle room for perfectly straight lines
- **Connection**: Automatic reconnection on failure
- **Default Speed**: 50% pan/tilt, level 5 zoom/focus

## Features in Detail

### Joystick Control
- Drag in any direction to pan/tilt
- Distance from center determines speed
- Intelligent axis locking prevents unwanted perpendicular movement
- 10-pixel dead zone for perfectly straight horizontal/vertical movements
- Visual "×" marker in joystick center

### Directional Button Mode
- 8-way directional control (↑↗→↘↓↙←↖)
- Center stop button (⏹)
- Great for touchscreens and compact layouts
- Instant directional response

### Speed Controls
- **Pan Speed**: 10-100% (default 50%)
- **Tilt Speed**: 10-100% (default 50%)
- **Zoom Speed**: 1-7 levels (default 5)
- **Focus Speed**: 1-7 levels (default 5)

### Responsive Design
- Automatically adjusts to card width
- Mobile-optimized touch controls
- Stacks vertically on narrow screens
- Compact mode for small spaces

## Troubleshooting

**Card not showing up?**
- Verify Lovelace resource is added correctly
- Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)
- Check browser console for errors

**Camera not responding?**
- Verify camera IP address is correct
- Check port 52381 is accessible
- Ensure VISCA is enabled on camera
- Check Home Assistant logs for connection errors
- Try pinging the camera from Home Assistant

**Joystick too sensitive?**
- Lower the Pan/Tilt speed sliders (try 25-30%)
- The directional lock helps prevent unwanted movement
- Use directional button mode for more precise control

**Joystick not centered on load?**
- This is fixed in v1.0.0 - clear browser cache and hard refresh

**Input loses focus when typing IP?**
- This is fixed in v1.0.0 - update to latest version

**Colors not changing?**
- Uncheck "Use Theme Colors" first
- Enter hex colors including the # symbol
- Hard refresh browser after changes

## Automation Examples

**Preset Positions:**
```yaml
automation:
  - alias: "Camera Home Position"
    trigger:
      - platform: state
        entity_id: input_boolean.camera_preset_home
        to: "on"
    action:
      - service: birddog_ptz.pan_tilt
        data:
          host: 192.168.1.100
          pan: 0
          tilt: 0
```

**Motion Detection:**
```yaml
automation:
  - alias: "Pan to motion"
    trigger:
      - platform: state
        entity_id: binary_sensor.motion_left
        to: "on"
    action:
      - service: birddog_ptz.pan_tilt
        data:
          host: 192.168.1.100
          pan: -80
          tilt: 0
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - Free to use and modify

## Changelog

### v1.0.0 (2025-01-08)
- Initial release
- Joystick and directional button modes
- Customizable display options
- Theme and custom color support
- Responsive design
- Fixed input focus issues in editor
- Default speed set to 50%
- Improved directional locking with 10px dead zone
- Joystick positioned correctly on load
- X symbol in joystick center