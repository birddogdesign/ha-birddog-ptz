class BirdDogPTZCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isDragging = false;
    this.lastCommand = null;
    this.commandInterval = null;
    this.panSpeed = 50;
    this.tiltSpeed = 50;
    this.zoomSpeed = 5;
    this.focusSpeed = 5;
    this.dragStartPos = null;
    this.dominantAxis = null;
    this.axisThreshold = 20;
    this.deadZone = 10;
  }

  static getConfigElement() {
    return document.createElement("birddog-ptz-card-editor");
  }

  static getStubConfig() {
    return {
      host: "",
      port: 52381,
      name: "BirdDog Camera",
      show_joystick: true,
      show_speed_controls: true,
      show_zoom_focus: true,
      use_theme_colors: true,
      joystick_color: "",
      button_color: ""
    };
  }

  setConfig(config) {
    if (!config.host) {
      throw new Error('Please configure the camera IP address using the visual editor');
    }
    this.config = {
      host: config.host,
      port: config.port || 52381,
      name: config.name || "BirdDog PTZ Control",
      show_joystick: config.show_joystick !== false,
      show_speed_controls: config.show_speed_controls !== false,
      show_zoom_focus: config.show_zoom_focus !== false,
      use_theme_colors: config.use_theme_colors !== false,
      joystick_color: config.joystick_color || "",
      button_color: config.button_color || ""
    };
    if (this.shadowRoot.querySelector('.card')) {
      this.render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.querySelector('.card')) {
      this.render();
    }
  }

  render() {
    const joystickColor = this.config.use_theme_colors ? 
      'var(--primary-color)' : 
      (this.config.joystick_color || 'var(--primary-color)');
    
    const buttonColor = this.config.use_theme_colors ? 
      'var(--primary-color)' : 
      (this.config.button_color || 'var(--primary-color)');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        
        .card {
          background: var(--ha-card-background, var(--card-background-color, white));
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.1));
          padding: 16px;
        }
        
        .card-header {
          font-size: 24px;
          font-weight: 400;
          padding: 0 0 16px 0;
          color: var(--primary-text-color);
        }
        
        .controls {
          display: grid;
          grid-template-columns: ${this.config.show_zoom_focus ? '1fr 1fr' : '1fr'};
          gap: 16px;
          margin-bottom: ${this.config.show_speed_controls ? '16px' : '0'};
        }
        
        @media (max-width: 600px) {
          .controls {
            grid-template-columns: 1fr;
          }
        }
        
        .joystick-container {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          max-width: 300px;
          margin: 0 auto;
        }
        
        .joystick {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: var(--primary-background-color);
          border: 2px solid var(--divider-color);
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.1);
          position: relative;
          touch-action: none;
          cursor: pointer;
        }
        
        .joystick-center {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 8px;
          height: 8px;
          background: var(--disabled-text-color);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.3;
        }
        
        .joystick-stick {
          position: absolute;
          width: 60px;
          height: 60px;
          background: ${joystickColor};
          border-radius: 50%;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          transition: all 0.1s ease-out;
          pointer-events: none;
          display: ${this.config.show_joystick ? 'flex' : 'none'};
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: var(--text-primary-color, white);
          font-weight: bold;
        }
        
        .joystick-stick.active {
          transition: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .directional-controls {
          position: absolute;
          width: 100%;
          height: 100%;
          display: ${this.config.show_joystick ? 'none' : 'grid'};
          grid-template-columns: 1fr 1fr 1fr;
          grid-template-rows: 1fr 1fr 1fr;
        }
        
        .dir-button {
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          color: ${joystickColor};
          transition: all 0.2s;
          touch-action: none;
          user-select: none;
        }
        
        .dir-button:hover {
          background: rgba(0,0,0,0.05);
        }
        
        .dir-button:active {
          background: rgba(0,0,0,0.1);
        }
        
        .dir-button.center {
          font-size: 20px;
          opacity: 0.5;
        }
        
        .zoom-focus-controls {
          display: ${this.config.show_zoom_focus ? 'flex' : 'none'};
          flex-direction: column;
          gap: 12px;
          justify-content: center;
        }
        
        .control-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .control-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--secondary-text-color);
          text-align: center;
        }
        
        .button-group {
          display: flex;
          gap: 8px;
          justify-content: center;
          flex-wrap: wrap;
        }
        
        .control-button {
          padding: 12px 20px;
          border: none;
          border-radius: var(--ha-card-border-radius, 4px);
          background: ${buttonColor};
          color: var(--text-primary-color, white);
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          touch-action: none;
          user-select: none;
          min-width: 80px;
          transition: all 0.2s;
          font-family: var(--paper-font-body1_-_font-family);
        }
        
        .control-button:hover {
          filter: brightness(1.1);
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        
        .control-button:active {
          transform: translateY(1px);
          box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        
        .speed-settings {
          display: ${this.config.show_speed_controls ? 'block' : 'none'};
          margin-top: 16px;
          padding: 16px;
          background: var(--primary-background-color);
          border: 1px solid var(--divider-color);
          border-radius: var(--ha-card-border-radius, 4px);
        }
        
        .speed-settings-header {
          font-size: 14px;
          font-weight: 500;
          color: var(--primary-text-color);
          margin-bottom: 12px;
        }
        
        .speed-slider-group {
          display: grid;
          grid-template-columns: 80px 1fr 50px;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        
        @media (max-width: 400px) {
          .speed-slider-group {
            grid-template-columns: 60px 1fr 40px;
            gap: 8px;
          }
          
          .control-button {
            min-width: 60px;
            padding: 10px 15px;
            font-size: 14px;
          }
        }
        
        .speed-label {
          font-size: 13px;
          color: var(--secondary-text-color);
        }
        
        .speed-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: var(--divider-color);
          outline: none;
        }
        
        .speed-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${joystickColor};
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .speed-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${joystickColor};
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .speed-value {
          font-size: 13px;
          color: var(--primary-text-color);
          text-align: right;
          font-weight: 500;
        }
      </style>
      
      <div class="card">
        <div class="card-header">${this.config.name}</div>
        
        <div class="controls">
          <div class="joystick-container">
            <div class="joystick" id="joystick">
              <div class="joystick-center"></div>
              <div class="joystick-stick" id="stick">×</div>
              <div class="directional-controls" id="dir-controls">
                <button class="dir-button" data-dir="upleft">↖</button>
                <button class="dir-button" data-dir="up">↑</button>
                <button class="dir-button" data-dir="upright">↗</button>
                <button class="dir-button" data-dir="left">←</button>
                <button class="dir-button center" data-dir="stop">⏹</button>
                <button class="dir-button" data-dir="right">→</button>
                <button class="dir-button" data-dir="downleft">↙</button>
                <button class="dir-button" data-dir="down">↓</button>
                <button class="dir-button" data-dir="downright">↘</button>
              </div>
            </div>
          </div>
          
          <div class="zoom-focus-controls">
            <div class="control-group">
              <div class="control-label">Zoom</div>
              <div class="button-group">
                <button class="control-button" id="zoom-out">−</button>
                <button class="control-button" id="zoom-in">+</button>
              </div>
            </div>
            
            <div class="control-group">
              <div class="control-label">Focus</div>
              <div class="button-group">
                <button class="control-button" id="focus-near">Near</button>
                <button class="control-button" id="focus-far">Far</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="speed-settings">
          <div class="speed-settings-header">Speed Settings</div>
          
          <div class="speed-slider-group">
            <div class="speed-label">Pan</div>
            <input type="range" class="speed-slider" id="pan-speed" min="10" max="100" value="50" step="5">
            <div class="speed-value"><span id="pan-speed-value">50</span>%</div>
          </div>
          
          <div class="speed-slider-group">
            <div class="speed-label">Tilt</div>
            <input type="range" class="speed-slider" id="tilt-speed" min="10" max="100" value="50" step="5">
            <div class="speed-value"><span id="tilt-speed-value">50</span>%</div>
          </div>
          
          <div class="speed-slider-group">
            <div class="speed-label">Zoom</div>
            <input type="range" class="speed-slider" id="zoom-speed" min="1" max="7" value="5" step="1">
            <div class="speed-value"><span id="zoom-speed-value">5</span></div>
          </div>
          
          <div class="speed-slider-group">
            <div class="speed-label">Focus</div>
            <input type="range" class="speed-slider" id="focus-speed" min="1" max="7" value="5" step="1">
            <div class="speed-value"><span id="focus-speed-value">5</span></div>
          </div>
        </div>
      </div>
    `;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.config.show_joystick) {
      this.setupJoystick();
    } else {
      this.setupDirectionalButtons();
    }
    
    if (this.config.show_zoom_focus) {
      const zoomIn = this.shadowRoot.getElementById('zoom-in');
      const zoomOut = this.shadowRoot.getElementById('zoom-out');
      const focusNear = this.shadowRoot.getElementById('focus-near');
      const focusFar = this.shadowRoot.getElementById('focus-far');
      
      this.setupButton(zoomIn, 'zoom_in');
      this.setupButton(zoomOut, 'zoom_out');
      this.setupButton(focusNear, 'focus_near');
      this.setupButton(focusFar, 'focus_far');
    }
    
    if (this.config.show_speed_controls) {
      const panSpeedSlider = this.shadowRoot.getElementById('pan-speed');
      const tiltSpeedSlider = this.shadowRoot.getElementById('tilt-speed');
      const zoomSpeedSlider = this.shadowRoot.getElementById('zoom-speed');
      const focusSpeedSlider = this.shadowRoot.getElementById('focus-speed');
      
      const panSpeedValue = this.shadowRoot.getElementById('pan-speed-value');
      const tiltSpeedValue = this.shadowRoot.getElementById('tilt-speed-value');
      const zoomSpeedValue = this.shadowRoot.getElementById('zoom-speed-value');
      const focusSpeedValue = this.shadowRoot.getElementById('focus-speed-value');
      
      panSpeedSlider.addEventListener('input', (e) => {
        this.panSpeed = parseInt(e.target.value);
        panSpeedValue.textContent = this.panSpeed;
      });
      
      tiltSpeedSlider.addEventListener('input', (e) => {
        this.tiltSpeed = parseInt(e.target.value);
        tiltSpeedValue.textContent = this.tiltSpeed;
      });
      
      zoomSpeedSlider.addEventListener('input', (e) => {
        this.zoomSpeed = parseInt(e.target.value);
        zoomSpeedValue.textContent = this.zoomSpeed;
      });
      
      focusSpeedSlider.addEventListener('input', (e) => {
        this.focusSpeed = parseInt(e.target.value);
        focusSpeedValue.textContent = this.focusSpeed;
      });
    }
  }

  setupDirectionalButtons() {
    const buttons = this.shadowRoot.querySelectorAll('.dir-button');
    
    buttons.forEach(button => {
      const dir = button.dataset.dir;
      
      const start = () => {
        let pan = 0, tilt = 0;
        const speed = 100;
        
        switch(dir) {
          case 'up': tilt = speed; break;
          case 'down': tilt = -speed; break;
          case 'left': pan = -speed; break;
          case 'right': pan = speed; break;
          case 'upleft': pan = -speed; tilt = speed; break;
          case 'upright': pan = speed; tilt = speed; break;
          case 'downleft': pan = -speed; tilt = -speed; break;
          case 'downright': pan = speed; tilt = -speed; break;
          case 'stop': this.stopMovement(); return;
        }
        
        this.sendPanTilt(pan, tilt);
      };
      
      const stop = () => {
        if (dir !== 'stop') {
          this.stopMovement();
        }
      };
      
      button.addEventListener('mousedown', start);
      button.addEventListener('touchstart', start);
      button.addEventListener('mouseup', stop);
      button.addEventListener('touchend', stop);
      button.addEventListener('mouseleave', stop);
    });
  }
  
  setupJoystick() {
    const joystick = this.shadowRoot.getElementById('joystick');
    const stick = this.shadowRoot.getElementById('stick');
    
    const startDrag = (e) => {
      e.preventDefault();
      this.isDragging = true;
      stick.classList.add('active');
      
      const rect = joystick.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      let clientX, clientY;
      if (e.type.startsWith('touch')) {
        clientX = e.touches[0].clientX - rect.left;
        clientY = e.touches[0].clientY - rect.top;
      } else {
        clientX = e.clientX - rect.left;
        clientY = e.clientY - rect.top;
      }
      
      this.dragStartPos = {
        x: clientX - centerX,
        y: clientY - centerY
      };
      this.dominantAxis = null;
      
      this.startCommandLoop();
    };
    
    const stopDrag = () => {
      if (this.isDragging) {
        this.isDragging = false;
        stick.classList.remove('active');
        this.resetStick();
        this.stopMovement();
        this.stopCommandLoop();
        this.dragStartPos = null;
        this.dominantAxis = null;
      }
    };
    
    const handleMove = (e) => {
      if (!this.isDragging) return;
      
      const rect = joystick.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      let clientX, clientY;
      if (e.type.startsWith('touch')) {
        clientX = e.touches[0].clientX - rect.left;
        clientY = e.touches[0].clientY - rect.top;
      } else {
        clientX = e.clientX - rect.left;
        clientY = e.clientY - rect.top;
      }
      
      let deltaX = clientX - centerX;
      let deltaY = clientY - centerY;
      
      if (this.dominantAxis === null && this.dragStartPos) {
        const totalDragX = Math.abs(deltaX);
        const totalDragY = Math.abs(deltaY);
        
        if (totalDragX > this.axisThreshold || totalDragY > this.axisThreshold) {
          if (totalDragX > totalDragY * 2) {
            this.dominantAxis = 'horizontal';
          } else if (totalDragY > totalDragX * 2) {
            this.dominantAxis = 'vertical';
          } else {
            this.dominantAxis = 'both';
          }
        }
      }
      
      if (this.dominantAxis === 'horizontal') {
        if (Math.abs(deltaY) < this.deadZone) {
          deltaY = 0;
        } else {
          const perpendicularRatio = Math.abs(deltaY) / (Math.abs(deltaX) + 1);
          if (perpendicularRatio > 0.4) {
            this.dominantAxis = 'both';
          } else {
            deltaY = 0;
          }
        }
      } else if (this.dominantAxis === 'vertical') {
        if (Math.abs(deltaX) < this.deadZone) {
          deltaX = 0;
        } else {
          const perpendicularRatio = Math.abs(deltaX) / (Math.abs(deltaY) + 1);
          if (perpendicularRatio > 0.4) {
            this.dominantAxis = 'both';
          } else {
            deltaX = 0;
          }
        }
      }
      
      const maxDistance = rect.width / 2 - 40;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (distance > maxDistance) {
        const angle = Math.atan2(deltaY, deltaX);
        deltaX = Math.cos(angle) * maxDistance;
        deltaY = Math.sin(angle) * maxDistance;
      }
      
      stick.style.left = `${centerX + deltaX}px`;
      stick.style.top = `${centerY + deltaY}px`;
      
      const panSpeed = Math.round((deltaX / maxDistance) * 100 * (this.panSpeed / 100));
      const tiltSpeed = Math.round((-deltaY / maxDistance) * 100 * (this.tiltSpeed / 100));
      
      this.lastCommand = { pan: panSpeed, tilt: tiltSpeed };
    };
    
    joystick.addEventListener('mousedown', startDrag);
    joystick.addEventListener('touchstart', startDrag);
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove);
    
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
  }
  
  setupButton(button, action) {
    const start = () => {
      const data = { host: this.config.host, port: this.config.port };
      if (action.includes('zoom')) {
        data.speed = this.zoomSpeed;
      } else if (action.includes('focus')) {
        data.speed = this.focusSpeed;
      }
      this.callService(action, data);
    };
    const stop = () => this.callService(`${action}_stop`, { host: this.config.host, port: this.config.port });
    
    button.addEventListener('mousedown', start);
    button.addEventListener('touchstart', start);
    button.addEventListener('mouseup', stop);
    button.addEventListener('touchend', stop);
    button.addEventListener('mouseleave', stop);
  }
  
  startCommandLoop() {
    this.commandInterval = setInterval(() => {
      if (this.lastCommand && this.isDragging) {
        this.sendPanTilt(this.lastCommand.pan, this.lastCommand.tilt);
      }
    }, 100);
  }
  
  stopCommandLoop() {
    if (this.commandInterval) {
      clearInterval(this.commandInterval);
      this.commandInterval = null;
    }
  }
  
  resetStick() {
    const stick = this.shadowRoot.getElementById('stick');
    if (stick) {
      stick.style.left = '50%';
      stick.style.top = '50%';
    }
  }
  
  sendPanTilt(pan, tilt) {
    this.callService('pan_tilt', { host: this.config.host, port: this.config.port, pan, tilt });
  }
  
  stopMovement() {
    this.callService('stop', { host: this.config.host, port: this.config.port });
    this.lastCommand = null;
  }
  
  callService(service, data) {
    this._hass.callService('birddog_ptz', service, data);
  }

  getCardSize() {
    let size = 3;
    if (this.config.show_zoom_focus) size += 1;
    if (this.config.show_speed_controls) size += 2;
    return size;
  }
}

class BirdDogPTZCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .card-config {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px 0;
        }
        
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        label {
          font-size: 14px;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        
        input[type="text"],
        input[type="number"] {
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--primary-background-color);
          color: var(--primary-text-color);
          font-size: 14px;
        }
        
        input[type="text"]:focus,
        input[type="number"]:focus {
          outline: none;
          border-color: var(--primary-color);
        }
        
        input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }
        
        .section-header {
          font-size: 16px;
          font-weight: 600;
          color: var(--primary-text-color);
          margin-top: 8px;
          border-bottom: 1px solid var(--divider-color);
          padding-bottom: 4px;
        }
      </style>
      <div class="card-config">
        <div class="section-header">Basic Settings</div>
        
        <div class="input-group">
          <label for="name">Camera Name</label>
          <input
            id="name"
            type="text"
            value="${this._config.name || 'BirdDog Camera'}"
            placeholder="BirdDog Camera"
          />
        </div>
        
        <div class="input-group">
          <label for="host">Camera IP Address *</label>
          <input
            id="host"
            type="text"
            value="${this._config.host || ''}"
            placeholder="192.168.1.100"
            required
          />
        </div>
        
        <div class="input-group">
          <label for="port">VISCA Port</label>
          <input
            id="port"
            type="number"
            value="${this._config.port || 52381}"
            placeholder="52381"
          />
        </div>
        
        <div class="section-header">Display Options</div>
        
        <div class="checkbox-group">
          <input
            type="checkbox"
            id="show_joystick"
            ${this._config.show_joystick !== false ? 'checked' : ''}
          />
          <label for="show_joystick">Show Joystick (if unchecked, shows directional buttons)</label>
        </div>
        
        <div class="checkbox-group">
          <input
            type="checkbox"
            id="show_speed_controls"
            ${this._config.show_speed_controls !== false ? 'checked' : ''}
          />
          <label for="show_speed_controls">Show Speed Controls</label>
        </div>
        
        <div class="checkbox-group">
          <input
            type="checkbox"
            id="show_zoom_focus"
            ${this._config.show_zoom_focus !== false ? 'checked' : ''}
          />
          <label for="show_zoom_focus">Show Zoom/Focus Buttons</label>
        </div>
        
        <div class="section-header">Color Settings</div>
        
        <div class="checkbox-group">
          <input
            type="checkbox"
            id="use_theme_colors"
            ${this._config.use_theme_colors !== false ? 'checked' : ''}
          />
          <label for="use_theme_colors">Use Theme Colors</label>
        </div>
        
        <div class="input-group">
          <label for="joystick_color">Joystick Color (Hex, e.g., #FF5733)</label>
          <input
            id="joystick_color"
            type="text"
            value="${this._config.joystick_color || ''}"
            placeholder="#FF5733"
            ${this._config.use_theme_colors !== false ? 'disabled' : ''}
          />
        </div>
        
        <div class="input-group">
          <label for="button_color">Button Color (Hex, e.g., #3498DB)</label>
          <input
            id="button_color"
            type="text"
            value="${this._config.button_color || ''}"
            placeholder="#3498DB"
            ${this._config.use_theme_colors !== false ? 'disabled' : ''}
          />
        </div>
      </div>
    `;
    
    this.shadowRoot.getElementById('name').addEventListener('change', (e) => this._valueChanged(e, 'name'));
    this.shadowRoot.getElementById('host').addEventListener('change', (e) => this._valueChanged(e, 'host'));
    this.shadowRoot.getElementById('port').addEventListener('change', (e) => this._valueChanged(e, 'port'));
    this.shadowRoot.getElementById('show_joystick').addEventListener('change', (e) => this._checkboxChanged(e, 'show_joystick'));
    this.shadowRoot.getElementById('show_speed_controls').addEventListener('change', (e) => this._checkboxChanged(e, 'show_speed_controls'));
    this.shadowRoot.getElementById('show_zoom_focus').addEventListener('change', (e) => this._checkboxChanged(e, 'show_zoom_focus'));
    this.shadowRoot.getElementById('use_theme_colors').addEventListener('change', (e) => {
      this._checkboxChanged(e, 'use_theme_colors');
      const joystickInput = this.shadowRoot.getElementById('joystick_color');
      const buttonInput = this.shadowRoot.getElementById('button_color');
      if (e.target.checked) {
        joystickInput.disabled = true;
        buttonInput.disabled = true;
      } else {
        joystickInput.disabled = false;
        buttonInput.disabled = false;
      }
    });
    this.shadowRoot.getElementById('joystick_color').addEventListener('change', (e) => this._valueChanged(e, 'joystick_color'));
    this.shadowRoot.getElementById('button_color').addEventListener('change', (e) => this._valueChanged(e, 'button_color'));
  }

  _valueChanged(ev, configKey) {
    if (!this._config) {
      return;
    }
    
    const value = ev.target.value;
    
    this._config = {
      ...this._config,
      [configKey]: configKey === 'port' ? parseInt(value) || 52381 : value
    };
    
    this._fireEvent();
  }

  _checkboxChanged(ev, configKey) {
    if (!this._config) {
      return;
    }
    
    this._config = {
      ...this._config,
      [configKey]: ev.target.checked
    };
    
    this._fireEvent();
  }

  _fireEvent() {
    const event = new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }
}

customElements.define('birddog-ptz-card', BirdDogPTZCard);
customElements.define('birddog-ptz-card-editor', BirdDogPTZCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'birddog-ptz-card',
  name: 'BirdDog PTZ Control',
  description: 'Interactive joystick PTZ control for BirdDog cameras',
  preview: true
});