// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x121212); // Dark background
document.getElementById('container').appendChild(renderer.domElement);

// Motion recording functionality
let isRecording = false;
let isPaused = false;
let recordedFrames = [];
let recordingInterval = null;
let lastRecordTime = 0;
const RECORDING_INTERVAL = 50; // Check arm position every 50 seconds

// Angle calibration and limits - removing initial offsets as requested
const ANGLE_CALIBRATION = {
    arm1: 0,  // Remove the -10 degree offset
    arm2: 0   // Remove the 10 degree offset
};

// Custom zero positions and rotation limits
let CUSTOM_ZERO = {
    base: 0,
    arm1X: 0,
    arm1Z: 0,
    arm2X: 0,
    arm2Z: 0
};

let CUSTOM_LIMITS = {
    base: { min: 0, max: 360 },
    arm1X: { min: 0, max: 360 },
    arm1Z: { min: 0, max: 360 },
    arm2X: { min: 0, max: 360 },
    arm2Z: { min: 0, max: 360 }
};

// Angle limits
const ANGLE_LIMITS = {
    base: { min: 0, max: 360 },
    arm1X: { min: 0, max: 360 },
    arm1Z: { min: 0, max: 360 },
    arm2X: { min: 0, max: 360 },
    arm2Z: { min: 0, max: 360 }
};

// Flag to use custom zero - this will always be true now, as we're removing the toggle
let useCustomZero = true;

// Recording buttons
const startRecordBtn = document.getElementById('startRecordBtn');
const pauseRecordBtn = document.getElementById('pauseRecordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const recordingStatus = document.getElementById('recordingStatus');

// Start recording motion
function startRecording() {
    if (isRecording && !isPaused) return;
    
    if (!isRecording) {
        // Start a new recording
        recordedFrames = [];
        console.log('Started recording');
        recordingStatus.textContent = 'Recording...';
        recordingStatus.classList.add('recording-active');
    } else {
        // Resume from pause
        console.log('Resumed recording');
        recordingStatus.textContent = 'Recording...';
        recordingStatus.classList.remove('recording-paused');
        recordingStatus.classList.add('recording-active');
    }
    
    isRecording = true;
    isPaused = false;
    lastRecordTime = Date.now();
    
    // Update button states
    startRecordBtn.disabled = true;
    pauseRecordBtn.disabled = false;
    stopRecordBtn.disabled = false;
    
    // Start recording interval
    if (!recordingInterval) {
        recordingInterval = setInterval(captureFrame, RECORDING_INTERVAL);
    }
}

// Pause recording
function pauseRecording() {
    if (!isRecording || isPaused) return;
    
    isPaused = true;
    console.log('Paused recording');
    recordingStatus.textContent = 'Paused';
    recordingStatus.classList.remove('recording-active');
    recordingStatus.classList.add('recording-paused');
    
    // Update button states
    startRecordBtn.disabled = false;
    pauseRecordBtn.disabled = true;
    
    // Stop the interval
    if (recordingInterval) {
        clearInterval(recordingInterval);
        recordingInterval = null;
    }
}

// Stop recording and save
function stopRecording() {
    if (!isRecording) return;
    
    isRecording = false;
    isPaused = false;
    console.log('Stopped recording');
    recordingStatus.textContent = '';
    recordingStatus.classList.remove('recording-active', 'recording-paused');
    
    // Update button states
    startRecordBtn.disabled = false;
    pauseRecordBtn.disabled = true;
    stopRecordBtn.disabled = true;
    
    // Stop the interval
    if (recordingInterval) {
        clearInterval(recordingInterval);
        recordingInterval = null;
    }
    
    // Generate and download the sequence file
    if (recordedFrames.length > 0) {
        generateSequenceFile();
    } else {
        console.warn('No frames were recorded');
    }
}

// Convert raw angle to calibrated angle within limits
function calibrateAngle(rawAngle, jointType) {
    let calibratedAngle = rawAngle;
    
    // Apply custom zero and limits
    // Adjust angle relative to custom zero
    calibratedAngle = calibratedAngle - CUSTOM_ZERO[jointType];
    
    // Apply custom limits
    const customLimits = CUSTOM_LIMITS[jointType];
    if (customLimits) {
        calibratedAngle = Math.max(customLimits.min, Math.min(customLimits.max, calibratedAngle));
    }
    
    // For all joints, handle wrapping around 360 degrees
    calibratedAngle = ((calibratedAngle % 360) + 360) % 360;
    
    return Math.round(calibratedAngle);
}

// Convert calibrated angle back to raw angle for arm movement
function decalibrateAngle(calibratedAngle, jointType) {
    let rawAngle = calibratedAngle;
    
    // Apply custom zero
    rawAngle = calibratedAngle + CUSTOM_ZERO[jointType];
    
    return rawAngle;
}

// Set current position as custom zero
function setCurrentPositionAsZero() {
    // Get current angles in degrees
    const baseAngle = THREE.MathUtils.radToDeg(base.rotation.y);
    
    // Get arm segment angles (convert from radians to degrees)
    const arm1AngleX = armSegments.length > 0 ? 
        THREE.MathUtils.radToDeg(armSegments[0].rotation.x) : 0;
    const arm1AngleZ = armSegments.length > 0 ? 
        THREE.MathUtils.radToDeg(armSegments[0].rotation.z) : 0;
    
    const arm2AngleX = armSegments.length > 1 ? 
        THREE.MathUtils.radToDeg(armSegments[1].rotation.x) : 0;
    const arm2AngleZ = armSegments.length > 1 ? 
        THREE.MathUtils.radToDeg(armSegments[1].rotation.z) : 0;
    
    // Set these as the custom zero positions
    CUSTOM_ZERO.base = baseAngle;
    CUSTOM_ZERO.arm1X = arm1AngleX;
    CUSTOM_ZERO.arm1Z = arm1AngleZ;
    CUSTOM_ZERO.arm2X = arm2AngleX;
    CUSTOM_ZERO.arm2Z = arm2AngleZ;
    
    console.log(`Set custom zero position - Base: ${baseAngle.toFixed(2)}°, Arm1 X: ${arm1AngleX.toFixed(2)}°, Arm1 Z: ${arm1AngleZ.toFixed(2)}°, Arm2 X: ${arm2AngleX.toFixed(2)}°, Arm2 Z: ${arm2AngleZ.toFixed(2)}°`);
    
    // Instead of directly setting config values to zero, call syncConfigWithArmRotations
    // to properly calculate the calibrated angles based on the new custom zero
    syncConfigWithArmRotations();
    
    // Update GUI
    updateGUI();
}

// Reset to default zero position
function resetToDefaultZero() {
    CUSTOM_ZERO = {
        base: 0,
        arm1X: 0,
        arm1Z: 0,
        arm2X: 0,
        arm2Z: 0
    };
    console.log("Reset to default zero position");
    
    // Update displayed angles to match actual rotations
    syncConfigWithArmRotations();
    
    // Update GUI
    updateGUI();
}

// Set custom rotation limits
function setCustomLimits(jointType, min, max) {
    if (CUSTOM_LIMITS[jointType]) {
        CUSTOM_LIMITS[jointType].min = min;
        CUSTOM_LIMITS[jointType].max = max;
        console.log(`Set custom limits for ${jointType}: min=${min}°, max=${max}°`);
        
        // Enforce this specific limit immediately
        enforceJointLimit(jointType);
    }
}

// Function to enforce a limit on a specific joint
function enforceJointLimit(jointType) {
    let currentAngle, calibratedAngle, limitedAngle;
    
    switch(jointType) {
        case 'base':
            currentAngle = THREE.MathUtils.radToDeg(base.rotation.y);
            calibratedAngle = calibrateAngle(currentAngle, 'base');
            limitedAngle = Math.max(CUSTOM_LIMITS.base.min, 
                                 Math.min(CUSTOM_LIMITS.base.max, calibratedAngle));
            
            if (calibratedAngle !== limitedAngle) {
                console.log(`Enforcing base rotation limit: ${calibratedAngle}° → ${limitedAngle}°`);
                config.baseRotation = limitedAngle;
                updateBaseRotation();
            }
            break;
            
        case 'arm1X':
            if (armSegments.length > 0) {
                currentAngle = THREE.MathUtils.radToDeg(armSegments[0].rotation.x);
                calibratedAngle = calibrateAngle(currentAngle, 'arm1X');
                limitedAngle = Math.max(CUSTOM_LIMITS.arm1X.min, 
                                     Math.min(CUSTOM_LIMITS.arm1X.max, calibratedAngle));
                
                if (calibratedAngle !== limitedAngle) {
                    console.log(`Enforcing arm1 X rotation limit: ${calibratedAngle}° → ${limitedAngle}°`);
                    config.arm1RotationX = limitedAngle;
                    updateArm1Rotation();
                }
            }
            break;
            
        case 'arm1Z':
            if (armSegments.length > 0) {
                currentAngle = THREE.MathUtils.radToDeg(armSegments[0].rotation.z);
                calibratedAngle = calibrateAngle(currentAngle, 'arm1Z');
                limitedAngle = Math.max(CUSTOM_LIMITS.arm1Z.min, 
                                     Math.min(CUSTOM_LIMITS.arm1Z.max, calibratedAngle));
                
                if (calibratedAngle !== limitedAngle) {
                    console.log(`Enforcing arm1 Z rotation limit: ${calibratedAngle}° → ${limitedAngle}°`);
                    config.arm1RotationZ = limitedAngle;
                    updateArm1Rotation();
                }
            }
            break;
            
        case 'arm2X':
            if (armSegments.length > 1) {
                currentAngle = THREE.MathUtils.radToDeg(armSegments[1].rotation.x);
                calibratedAngle = calibrateAngle(currentAngle, 'arm2X');
                limitedAngle = Math.max(CUSTOM_LIMITS.arm2X.min, 
                                     Math.min(CUSTOM_LIMITS.arm2X.max, calibratedAngle));
                
                if (calibratedAngle !== limitedAngle) {
                    console.log(`Enforcing arm2 X rotation limit: ${calibratedAngle}° → ${limitedAngle}°`);
                    config.arm2RotationX = limitedAngle;
                    updateArm2Rotation();
                }
            }
            break;
            
        case 'arm2Z':
            if (armSegments.length > 1) {
                currentAngle = THREE.MathUtils.radToDeg(armSegments[1].rotation.z);
                calibratedAngle = calibrateAngle(currentAngle, 'arm2Z');
                limitedAngle = Math.max(CUSTOM_LIMITS.arm2Z.min, 
                                     Math.min(CUSTOM_LIMITS.arm2Z.max, calibratedAngle));
                
                if (calibratedAngle !== limitedAngle) {
                    console.log(`Enforcing arm2 Z rotation limit: ${calibratedAngle}° → ${limitedAngle}°`);
                    config.arm2RotationZ = limitedAngle;
                    updateArm2Rotation();
                }
            }
            break;
    }
    
    // Update GUI to reflect changes
    updateGUI();
    
    // Update target position to match arm
    updateTargetToArmTip();
}

// Capture current arm position
function captureFrame() {
    if (!isRecording || isPaused) return;
    
    const currentTime = Date.now();
    const duration = currentTime - lastRecordTime;
    lastRecordTime = currentTime;
    
    // Get current angles in degrees
    const rawBaseAngle = THREE.MathUtils.radToDeg(base.rotation.y);
    
    // Get arm segment angles (convert from radians to degrees)
    const rawArm1AngleX = armSegments.length > 0 ? 
        THREE.MathUtils.radToDeg(armSegments[0].rotation.x) : 0;
    const rawArm1AngleZ = armSegments.length > 0 ? 
        THREE.MathUtils.radToDeg(armSegments[0].rotation.z) : 0;
    
    const rawArm2AngleX = armSegments.length > 1 ? 
        THREE.MathUtils.radToDeg(armSegments[1].rotation.x) : 0;
    const rawArm2AngleZ = armSegments.length > 1 ? 
        THREE.MathUtils.radToDeg(armSegments[1].rotation.z) : 0;
    
    // Apply calibration and limits
    const baseAngle = calibrateAngle(rawBaseAngle, 'base');
    const arm1AngleX = calibrateAngle(rawArm1AngleX, 'arm1X');
    const arm1AngleZ = calibrateAngle(rawArm1AngleZ, 'arm1Z');
    const arm2AngleX = calibrateAngle(rawArm2AngleX, 'arm2X');
    const arm2AngleZ = calibrateAngle(rawArm2AngleZ, 'arm2Z');
    
    // Debug the calibration
    console.log(`Raw angles - Base: ${rawBaseAngle.toFixed(2)}°, Arm1 X: ${rawArm1AngleX.toFixed(2)}°, Arm1 Z: ${rawArm1AngleZ.toFixed(2)}°, Arm2 X: ${rawArm2AngleX.toFixed(2)}°, Arm2 Z: ${rawArm2AngleZ.toFixed(2)}°`);
    console.log(`Calibration offsets - Arm1 X: ${ANGLE_CALIBRATION.arm1}°, Arm1 Z: ${ANGLE_CALIBRATION.arm1}°, Arm2 X: ${ANGLE_CALIBRATION.arm2}°, Arm2 Z: ${ANGLE_CALIBRATION.arm2}°`);
    console.log(`Calibrated angles - Base: ${baseAngle}°, Arm1 X: ${arm1AngleX}°, Arm1 Z: ${arm1AngleZ}°, Arm2 X: ${arm2AngleX}°, Arm2 Z: ${arm2AngleZ}°`);
    
    // Add frame to recorded frames
    recordedFrames.push({
        baseAngle,
        arm1AngleX,
        arm1AngleZ,
        arm2AngleX,
        arm2AngleZ,
        duration: Math.max(1000, duration) // Minimum 1 second duration
    });
    
    console.log(`Recorded frame: Base=${baseAngle}° (raw: ${Math.round(rawBaseAngle)}°), Arm1 X: ${arm1AngleX}° (raw: ${Math.round(rawArm1AngleX)}°), Arm1 Z: ${arm1AngleZ}° (raw: ${Math.round(rawArm1AngleZ)}°), Arm2 X: ${arm2AngleX}° (raw: ${Math.round(rawArm2AngleX)}°), Arm2 Z: ${arm2AngleZ}° (raw: ${Math.round(rawArm2AngleZ)}°), Duration=${duration}ms`);
}

// Generate and download sequence file
function generateSequenceFile() {
    // Format the recorded frames as specified
    let fileContent = '{\n';
    
    recordedFrames.forEach((frame, index) => {
        fileContent += `  { ${frame.baseAngle.toString().padStart(3)}, ${frame.arm1AngleX.toString().padStart(3)}, ${frame.arm1AngleZ.toString().padStart(3)}, ${frame.arm2AngleX.toString().padStart(3)}, ${frame.arm2AngleZ.toString().padStart(3)}, ${frame.duration.toString().padStart(6)} }`;
        if (index < recordedFrames.length - 1) {
            fileContent += ',\n';
        } else {
            fileContent += '\n';
        }
    });
    
    fileContent += '};';
    
    // Create a download link
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robot_motion_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
    
    console.log(`Saved recording with ${recordedFrames.length} frames`);
}

// Add event listeners to recording buttons
startRecordBtn.addEventListener('click', startRecording);
pauseRecordBtn.addEventListener('click', pauseRecording);
stopRecordBtn.addEventListener('click', stopRecording);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7).normalize();
scene.add(directionalLight);

// Grid for reference
const gridHelper = new THREE.GridHelper(20, 20);
scene.add(gridHelper);

// Robot arm segments array to track all parts
let armSegments = [];

// Target for inverse kinematics
const targetGeometry = new THREE.SphereGeometry(0.4, 32, 32);
const targetMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.5
});
const target = new THREE.Mesh(targetGeometry, targetMaterial);

// Add outline to make target more visible against any background
const targetOutlineGeometry = new THREE.SphereGeometry(0.45, 32, 32);
const targetOutlineMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    transparent: true,
    opacity: 0.7,
    side: THREE.BackSide 
});
const targetOutline = new THREE.Mesh(targetOutlineGeometry, targetOutlineMaterial);
target.add(targetOutline);

scene.add(target);

// Make target more visible with a trail effect
const targetTrail = new THREE.Group();
scene.add(targetTrail);
const trailMaterial = new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.5 });
for (let i = 0; i < 5; i++) {
    const trailSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 - i * 0.02, 16, 16),
        trailMaterial.clone()
    );
    trailSphere.material.opacity = 0.6 - i * 0.1;
    targetTrail.add(trailSphere);
}

// Drag controls for target
const dragControls = new THREE.DragControls([target], camera, renderer.domElement);

// Robot arm configuration
const config = {
    numSegments: 2,
    baseRadius: 0.5,
    baseHeight: 1,
    segmentLength: 2,
    segmentWidth: 0.5,
    baseRotation: 0, // Base rotation around Y axis [0-360]
    arm1RotationX: 0, // Arm1 rotation around X axis
    arm1RotationZ: 0, // Arm1 rotation around Z axis
    arm2RotationX: 0, // Arm2 rotation around X axis
    arm2RotationZ: 0, // Arm2 rotation around Z axis
    targetMode: true,
    addSegment: function() { addArmSegment(); },
    removeSegment: function() { removeArmSegment(); },
    resetPosition: function() { resetArmPosition(); },
    IKenabled: true,
    // Custom zero position functions
    setAsZero: function() { setCurrentPositionAsZero(); },
    resetZero: function() { resetToDefaultZero(); },
    // Custom limits
    baseMinLimit: 0,
    baseMaxLimit: 360,
    arm1MinLimitX: 0,
    arm1MaxLimitX: 360,
    arm1MinLimitZ: 0,
    arm1MaxLimitZ: 360,
    arm2MinLimitX: 0,
    arm2MaxLimitX: 360,
    arm2MinLimitZ: 0,
    arm2MaxLimitZ: 360,
    updateLimits: function() { 
        setCustomLimits('base', this.baseMinLimit, this.baseMaxLimit);
        setCustomLimits('arm1X', this.arm1MinLimitX, this.arm1MaxLimitX);
        setCustomLimits('arm1Z', this.arm1MinLimitZ, this.arm1MaxLimitZ);
        setCustomLimits('arm2X', this.arm2MinLimitX, this.arm2MaxLimitX);
        setCustomLimits('arm2Z', this.arm2MinLimitZ, this.arm2MaxLimitZ);
        
        // Immediately enforce the new limits on all joints
        enforceAllLimits();
    }
};

// Track rotation locks for each arm segment
let rotationLocks = [];

// Function to check and enforce limits for all joints
function enforceAllLimits() {
    console.log("Enforcing all limits...");
    
    // Check base rotation against limits
    const baseAngle = THREE.MathUtils.radToDeg(base.rotation.y);
    const calibratedBaseAngle = calibrateAngle(baseAngle, 'base');
    
    // Apply limits to the calibrated angle
    const limitedBaseAngle = Math.max(CUSTOM_LIMITS.base.min, 
                                   Math.min(CUSTOM_LIMITS.base.max, calibratedBaseAngle));
    
    if (calibratedBaseAngle !== limitedBaseAngle) {
        console.log(`Enforcing base rotation limit: ${calibratedBaseAngle}° → ${limitedBaseAngle}°`);
        config.baseRotation = limitedBaseAngle;
        updateBaseRotation();
    }
    
    // Check arm1 rotations against limits
    if (armSegments.length > 0) {
        // Check X rotation
        const arm1AngleX = THREE.MathUtils.radToDeg(armSegments[0].rotation.x);
        const calibratedArm1X = calibrateAngle(arm1AngleX, 'arm1X');
        
        // Apply limits to the calibrated angle
        const limitedArm1X = Math.max(CUSTOM_LIMITS.arm1X.min, 
                                   Math.min(CUSTOM_LIMITS.arm1X.max, calibratedArm1X));
        
        if (calibratedArm1X !== limitedArm1X) {
            console.log(`Enforcing arm1 X rotation limit: ${calibratedArm1X}° → ${limitedArm1X}°`);
            config.arm1RotationX = limitedArm1X;
            updateArm1Rotation();
        }
        
        // Check Z rotation
        const arm1AngleZ = THREE.MathUtils.radToDeg(armSegments[0].rotation.z);
        const calibratedArm1Z = calibrateAngle(arm1AngleZ, 'arm1Z');
        
        // Apply limits to the calibrated angle
        const limitedArm1Z = Math.max(CUSTOM_LIMITS.arm1Z.min, 
                                   Math.min(CUSTOM_LIMITS.arm1Z.max, calibratedArm1Z));
        
        if (calibratedArm1Z !== limitedArm1Z) {
            console.log(`Enforcing arm1 Z rotation limit: ${calibratedArm1Z}° → ${limitedArm1Z}°`);
            config.arm1RotationZ = limitedArm1Z;
            updateArm1Rotation();
        }
    }
    
    // Check arm2 rotations against limits
    if (armSegments.length > 1) {
        // Check X rotation
        const arm2AngleX = THREE.MathUtils.radToDeg(armSegments[1].rotation.x);
        const calibratedArm2X = calibrateAngle(arm2AngleX, 'arm2X');
        
        // Apply limits to the calibrated angle
        const limitedArm2X = Math.max(CUSTOM_LIMITS.arm2X.min, 
                                   Math.min(CUSTOM_LIMITS.arm2X.max, calibratedArm2X));
        
        if (calibratedArm2X !== limitedArm2X) {
            console.log(`Enforcing arm2 X rotation limit: ${calibratedArm2X}° → ${limitedArm2X}°`);
            config.arm2RotationX = limitedArm2X;
            updateArm2Rotation();
        }
        
        // Check Z rotation
        const arm2AngleZ = THREE.MathUtils.radToDeg(armSegments[1].rotation.z);
        const calibratedArm2Z = calibrateAngle(arm2AngleZ, 'arm2Z');
        
        // Apply limits to the calibrated angle
        const limitedArm2Z = Math.max(CUSTOM_LIMITS.arm2Z.min, 
                                   Math.min(CUSTOM_LIMITS.arm2Z.max, calibratedArm2Z));
        
        if (calibratedArm2Z !== limitedArm2Z) {
            console.log(`Enforcing arm2 Z rotation limit: ${calibratedArm2Z}° → ${limitedArm2Z}°`);
            config.arm2RotationZ = limitedArm2Z;
            updateArm2Rotation();
        }
    }
    
    // Update GUI to reflect changes
    updateGUI();
    
    // Update target position to match arm
    updateTargetToArmTip();
}

// Create base
const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x4444aa, metalness: 0.5, roughness: 0.5 });
const baseGeometry = new THREE.CylinderGeometry(config.baseRadius, config.baseRadius, config.baseHeight, 32);
const base = new THREE.Mesh(baseGeometry, baseMaterial);
scene.add(base);

// Materials for arm segments
const segmentMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x44aa44, metalness: 0.6, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0xaa4444, metalness: 0.6, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0xaaaa44, metalness: 0.6, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0x44aaaa, metalness: 0.6, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0xaa44aa, metalness: 0.6, roughness: 0.4 })
];

// Create initial arm segments
function initializeArm() {
    // Remove any existing segments
    for (const segment of armSegments) {
        if (segment.parent) segment.parent.remove(segment);
    }
    armSegments = [];
    
    // Initialize rotation locks for each segment
    rotationLocks = [];

    // Create new segments
    let parent = base;
    let offset = config.baseHeight / 2; // Start from top of base

    for (let i = 0; i < config.numSegments; i++) {
        const material = segmentMaterials[i % segmentMaterials.length];
        const segmentGeometry = new THREE.BoxGeometry(config.segmentWidth, config.segmentLength, config.segmentWidth);
        
        // Move origin to bottom of segment for natural rotation
        segmentGeometry.translate(0, config.segmentLength / 2, 0);
        
        const segment = new THREE.Mesh(segmentGeometry, material);
        
        // Add joint visualization (sphere)
        const jointGeometry = new THREE.SphereGeometry(config.segmentWidth / 1.5, 16, 16);
        const jointMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
        const joint = new THREE.Mesh(jointGeometry, jointMaterial);
        segment.add(joint);
        
        // Set up default rotation locks (all axes unlocked)
        rotationLocks.push({ 
            x: false, // false means unlocked
            z: false
        });
        
        // Position the segment
        segment.position.y = offset;
        
        // Add to parent
        parent.add(segment);
        parent = segment;
        offset = config.segmentLength;
        
        // Track segment
        armSegments.push(segment);
        
        // Add user data for raycasting/selection
        segment.userData = { 
            isArmSegment: true,
            segmentIndex: i
        };
    }
    
    // Set initial arm positions - no offset now
    // All segments are initialized straight up
    
    // Initial position of target at arm tip
    updateTargetToArmTip();
}

// Function to add new arm segment
function addArmSegment() {
    if (armSegments.length === 0) {
        initializeArm();
        return;
    }
    
    const lastSegment = armSegments[armSegments.length - 1];
    const material = segmentMaterials[armSegments.length % segmentMaterials.length];
    
    const segmentGeometry = new THREE.BoxGeometry(config.segmentWidth, config.segmentLength, config.segmentWidth);
    segmentGeometry.translate(0, config.segmentLength / 2, 0);
    
    const newSegment = new THREE.Mesh(segmentGeometry, material);
    
    // Add joint visualization
    const jointGeometry = new THREE.SphereGeometry(config.segmentWidth / 1.5, 16, 16);
    const jointMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
    const joint = new THREE.Mesh(jointGeometry, jointMaterial);
    newSegment.add(joint);
    
    // Position at end of last segment
    newSegment.position.y = config.segmentLength;
    
    lastSegment.add(newSegment);
    armSegments.push(newSegment);
    
    // Add rotation lock for new segment
    rotationLocks.push({ 
        x: false,
        z: false
    });
    
    config.numSegments = armSegments.length;
    updateGUI();
    
    // Update target position
    updateTargetToArmTip();
}

// Function to remove last arm segment
function removeArmSegment() {
    if (armSegments.length > 1) {
        const lastSegment = armSegments.pop();
        if (lastSegment.parent) {
            lastSegment.parent.remove(lastSegment);
        }
        
        // Remove the last rotation lock
        rotationLocks.pop();
        
        config.numSegments = armSegments.length;
        updateGUI();
        
        // Update target position
        updateTargetToArmTip();
    }
}

// Position target at arm tip with offset
function updateTargetToArmTip() {
    if (armSegments.length === 0) return;
    
    // Calculate position of the tip of the last segment
    const lastSegment = armSegments[armSegments.length - 1];
    const tipPosition = new THREE.Vector3(0, config.segmentLength, 0);
    tipPosition.applyMatrix4(lastSegment.matrixWorld);
    
    // Add larger offset to make target more visible (0.6 units above)
    tipPosition.y += 0.6;
    
    // Set target position
    target.position.copy(tipPosition);
    
    // Update trail positions
    for (let i = 0; i < targetTrail.children.length; i++) {
        targetTrail.children[i].position.copy(tipPosition);
    }
}

// Reset arm position to straight up
function resetArmPosition() {
    // Reset base rotation
    base.rotation.y = 0;
    config.baseRotation = 0;
    
    // Reset arm segments to default positions
    if (armSegments.length > 0) {
        // First arm segment (arm1)
        armSegments[0].rotation.x = 0;
        armSegments[0].rotation.z = 0;
        config.arm1RotationX = 0;
        config.arm1RotationZ = 0;
    }
    
    if (armSegments.length > 1) {
        // Second arm segment (arm2)
        armSegments[1].rotation.x = 0;
        armSegments[1].rotation.z = 0;
        config.arm2RotationX = 0;
        config.arm2RotationZ = 0;
    }
    
    // Reset any additional segments to straight
    for (let i = 2; i < armSegments.length; i++) {
        armSegments[i].rotation.x = 0;
        armSegments[i].rotation.z = 0;
    }
    
    updateTargetToArmTip();
    updateGUI();
}

// Update base rotation
function updateBaseRotation() {
    // Apply custom limits if enabled
    if (useCustomZero) {
        // Get the angle relative to custom zero
        const relativeAngle = config.baseRotation;
        // Apply limits to the relative angle
        const limitedAngle = Math.max(CUSTOM_LIMITS.base.min, 
                                    Math.min(CUSTOM_LIMITS.base.max, relativeAngle));
        
        if (relativeAngle !== limitedAngle) {
            // Update the config if limits were applied
            config.baseRotation = limitedAngle;
            console.log(`Base rotation limited to ${limitedAngle}° (within custom limits)`);
        }
        
        // Convert back to raw angle for the 3D model
        const rawAngle = decalibrateAngle(config.baseRotation, 'base');
        base.rotation.y = THREE.MathUtils.degToRad(rawAngle);
    } else {
        // Standard behavior without custom limits
        base.rotation.y = THREE.MathUtils.degToRad(config.baseRotation);
    }
    updateTargetToArmTip();
}

// Update arm1 rotation
function updateArm1Rotation() {
    if (armSegments.length > 0) {
        // Only update if the axis is not locked
        if (!rotationLocks[0].x) {
            // Apply custom limits if enabled
            if (useCustomZero) {
                // Get the angle relative to custom zero
                const relativeAngle = config.arm1RotationX;
                // Apply limits to the relative angle
                const limitedAngle = Math.max(CUSTOM_LIMITS.arm1X.min, 
                                           Math.min(CUSTOM_LIMITS.arm1X.max, relativeAngle));
                
                if (relativeAngle !== limitedAngle) {
                    // Update the config if limits were applied
                    config.arm1RotationX = limitedAngle;
                    console.log(`Arm1 X rotation limited to ${limitedAngle}° (within custom limits)`);
                }
                
                // Convert back to raw angle for the 3D model
                const rawAngle = decalibrateAngle(config.arm1RotationX, 'arm1X');
                armSegments[0].rotation.x = THREE.MathUtils.degToRad(rawAngle);
            } else {
                // Standard behavior without custom limits
                armSegments[0].rotation.x = THREE.MathUtils.degToRad(config.arm1RotationX);
            }
        }
        
        if (!rotationLocks[0].z) {
            // Apply custom limits if enabled
            if (useCustomZero) {
                // Get the angle relative to custom zero
                const relativeAngle = config.arm1RotationZ;
                // Apply limits to the relative angle
                const limitedAngle = Math.max(CUSTOM_LIMITS.arm1Z.min, 
                                           Math.min(CUSTOM_LIMITS.arm1Z.max, relativeAngle));
                
                if (relativeAngle !== limitedAngle) {
                    // Update the config if limits were applied
                    config.arm1RotationZ = limitedAngle;
                    console.log(`Arm1 Z rotation limited to ${limitedAngle}° (within custom limits)`);
                }
                
                // Convert back to raw angle for the 3D model
                const rawAngle = decalibrateAngle(config.arm1RotationZ, 'arm1Z');
                armSegments[0].rotation.z = THREE.MathUtils.degToRad(rawAngle);
            } else {
                // Standard behavior without custom limits
                armSegments[0].rotation.z = THREE.MathUtils.degToRad(config.arm1RotationZ);
            }
        }
        updateTargetToArmTip();
    }
}

// Update arm2 rotation
function updateArm2Rotation() {
    if (armSegments.length > 1) {
        // Only update if the axis is not locked
        if (!rotationLocks[1].x) {
            // Apply custom limits if enabled
            if (useCustomZero) {
                // Get the angle relative to custom zero
                const relativeAngle = config.arm2RotationX;
                // Apply limits to the relative angle
                const limitedAngle = Math.max(CUSTOM_LIMITS.arm2X.min, 
                                           Math.min(CUSTOM_LIMITS.arm2X.max, relativeAngle));
                
                if (relativeAngle !== limitedAngle) {
                    // Update the config if limits were applied
                    config.arm2RotationX = limitedAngle;
                    console.log(`Arm2 X rotation limited to ${limitedAngle}° (within custom limits)`);
                }
                
                // Convert back to raw angle for the 3D model
                const rawAngle = decalibrateAngle(limitedAngle, 'arm2X');
                armSegments[1].rotation.x = THREE.MathUtils.degToRad(rawAngle);
            } else {
                // Standard behavior without custom limits
                armSegments[1].rotation.x = calibrateAngle(relativeAngle, 'arm2X');
            }
            console.log(`IK updated arm2 X rotation to ${config.arm2RotationX}° (raw: ${relativeAngle.toFixed(2)}°)`);
        }
        
        if (!rotationLocks[1].z) {
            // Apply custom limits if enabled
            if (useCustomZero) {
                // Get the angle relative to custom zero
                const relativeAngle = config.arm2RotationZ;
                // Apply limits to the relative angle
                const limitedAngle = Math.max(CUSTOM_LIMITS.arm2Z.min, 
                                           Math.min(CUSTOM_LIMITS.arm2Z.max, relativeAngle));
                
                if (relativeAngle !== limitedAngle) {
                    // Update the config if limits were applied
                    config.arm2RotationZ = limitedAngle;
                    console.log(`Arm2 Z rotation limited to ${limitedAngle}° (within custom limits)`);
                }
                
                // Convert back to raw angle for the 3D model
                const rawAngle = decalibrateAngle(limitedAngle, 'arm2Z');
                armSegments[1].rotation.z = THREE.MathUtils.degToRad(rawAngle);
                
                console.log(`IK updated arm2 Z rotation to ${config.arm2RotationZ}° (raw: ${relativeAngle.toFixed(2)}°)`);
            } else {
                armSegments[1].rotation.z = calibrateAngle(relativeAngle, 'arm2Z');
                
                // Update config for arm2
                if (relativeAngle !== config.arm2RotationZ) {
                    config.arm2RotationZ = calibrateAngle(relativeAngle, 'arm2Z');
                    console.log(`IK updated arm2 Z rotation to ${config.arm2RotationZ}° (raw: ${relativeAngle.toFixed(2)}°)`);
                }
            }
        }
        updateTargetToArmTip();
    }
}

// Update all arm rotations from config
function updateAllRotations() {
    updateBaseRotation();
    updateArm1Rotation();
    updateArm2Rotation();
}

// Sync config values with current arm rotations
function syncConfigWithArmRotations() {
    // Get current angles and apply calibration
    const baseAngle = THREE.MathUtils.radToDeg(base.rotation.y);
    const calibratedBaseAngle = calibrateAngle(baseAngle, 'base');
    
    // Only update if the value has changed to avoid unnecessary GUI updates
    if (config.baseRotation !== calibratedBaseAngle) {
        config.baseRotation = calibratedBaseAngle;
        console.log(`Updated base rotation to ${calibratedBaseAngle}°`);
    }
    
    if (armSegments.length > 0) {
        const arm1AngleX = THREE.MathUtils.radToDeg(armSegments[0].rotation.x);
        const arm1AngleZ = THREE.MathUtils.radToDeg(armSegments[0].rotation.z);
        
        const calibratedArm1X = calibrateAngle(arm1AngleX, 'arm1X');
        const calibratedArm1Z = calibrateAngle(arm1AngleZ, 'arm1Z');
        
        console.log(`Arm1 current angles - X: ${arm1AngleX.toFixed(2)}° (calibrated: ${calibratedArm1X}°), Z: ${arm1AngleZ.toFixed(2)}° (calibrated: ${calibratedArm1Z}°)`);
        console.log(`Arm1 config values - X: ${config.arm1RotationX}°, Z: ${config.arm1RotationZ}°`);
        
        // Only update if the values have changed
        if (config.arm1RotationX !== calibratedArm1X) {
            config.arm1RotationX = calibratedArm1X;
            console.log(`Updated arm1 X rotation to ${calibratedArm1X}°`);
        }
        
        if (config.arm1RotationZ !== calibratedArm1Z) {
            config.arm1RotationZ = calibratedArm1Z;
            console.log(`Updated arm1 Z rotation to ${calibratedArm1Z}°`);
        }
    }
    
    if (armSegments.length > 1) {
        const arm2AngleX = THREE.MathUtils.radToDeg(armSegments[1].rotation.x);
        const arm2AngleZ = THREE.MathUtils.radToDeg(armSegments[1].rotation.z);
        
        const calibratedArm2X = calibrateAngle(arm2AngleX, 'arm2X');
        const calibratedArm2Z = calibrateAngle(arm2AngleZ, 'arm2Z');
        
        // Only update if the values have changed
        if (config.arm2RotationX !== calibratedArm2X) {
            config.arm2RotationX = calibratedArm2X;
            console.log(`Updated arm2 X rotation to ${calibratedArm2X}°`);
        }
        
        if (config.arm2RotationZ !== calibratedArm2Z) {
            config.arm2RotationZ = calibratedArm2Z;
            console.log(`Updated arm2 Z rotation to ${calibratedArm2Z}°`);
        }
    }
    
    // Update GUI to reflect new values
    updateGUI();
}

// Inverse Kinematics implementation using FABRIK algorithm
function applyInverseKinematics() {
    if (armSegments.length === 0) return;
    
    // Get joint positions in world space
    const jointPositions = [];
    
    // Base is the first joint
    const basePosition = new THREE.Vector3(0, config.baseHeight / 2, 0);
    basePosition.applyMatrix4(base.matrixWorld);
    jointPositions.push(basePosition.clone());
    
    // Add all segment joints
    for (const segment of armSegments) {
        const jointPosition = new THREE.Vector3(0, 0, 0);
        jointPosition.applyMatrix4(segment.matrixWorld);
        jointPositions.push(jointPosition.clone());
        
        // Also add the tip of this segment
        const tipPosition = new THREE.Vector3(0, config.segmentLength, 0);
        tipPosition.applyMatrix4(segment.matrixWorld);
        jointPositions.push(tipPosition.clone());
    }
    
    // Simplify to just have the pivot points (remove the in-between points)
    const pivots = [jointPositions[0]]; // Base
    for (let i = 2; i < jointPositions.length; i += 2) {
        pivots.push(jointPositions[i]);
    }
    
    // FABRIK algorithm
    // First pass - backward
    pivots[pivots.length - 1].copy(target.position);
    
    for (let i = pivots.length - 2; i >= 0; i--) {
        const dir = pivots[i].clone().sub(pivots[i + 1]).normalize();
        const segmentLength = i === 0 ? config.baseHeight : config.segmentLength;
        pivots[i].copy(pivots[i + 1]).add(dir.multiplyScalar(segmentLength));
    }
    
    // Second pass - forward
    // Base doesn't move
    for (let i = 1; i < pivots.length; i++) {
        const dir = pivots[i].clone().sub(pivots[i - 1]).normalize();
        const segmentLength = i === 1 ? config.baseHeight : config.segmentLength;
        pivots[i].copy(pivots[i - 1]).add(dir.multiplyScalar(segmentLength));
    }
    
    // Calculate base rotation based on target position
    const targetXZ = new THREE.Vector2(target.position.x, target.position.z);
    if (targetXZ.length() > 0.001) {  // Only rotate if there's a significant XZ offset
        // Use atan2 to get the full 360-degree range
        const baseAngle = Math.atan2(target.position.x, target.position.z);
        
        // Convert to degrees for easier handling
        let baseRotationDeg = THREE.MathUtils.radToDeg(baseAngle);
        
        // Ensure we get a value in the range [0, 360)
        baseRotationDeg = ((baseRotationDeg % 360) + 360) % 360;
        
        // Store the current base rotation before applying new rotation
        const currentBaseRotation = THREE.MathUtils.radToDeg(base.rotation.y);
        const currentNormalized = ((currentBaseRotation % 360) + 360) % 360;
        
        // Determine if we should go the long way around to avoid discontinuities
        // This helps prevent the arm from suddenly flipping when crossing the 180-degree boundary
        let finalRotation = baseRotationDeg;
        
        // Apply custom limits if enabled
        if (useCustomZero) {
            // Apply custom limits to base rotation
            const relativeToCustZero = finalRotation - CUSTOM_ZERO.base;
            const limitedRelative = Math.max(CUSTOM_LIMITS.base.min, 
                                           Math.min(CUSTOM_LIMITS.base.max, relativeToCustZero));
            finalRotation = CUSTOM_ZERO.base + limitedRelative;
        }
        
        // Apply the rotation
        base.rotation.y = THREE.MathUtils.degToRad(finalRotation);
        
        // Update the config value with the calibrated angle
        config.baseRotation = calibrateAngle(finalRotation, 'base');
        
        console.log(`Base rotation updated: ${finalRotation.toFixed(2)}° (calibrated: ${config.baseRotation}°)`);
    }
    
    // Apply rotations
    // For base to first segment
    if (armSegments.length > 0) {
        const baseToFirstSegment = pivots[1].clone().sub(pivots[0]);
        
        // Only apply rotations if the axis is not locked
        if (!rotationLocks[0].x) {
            // Calculate rotation for X (forward/back)
            const xAngle = Math.atan2(baseToFirstSegment.z, baseToFirstSegment.y);
            armSegments[0].rotation.x = xAngle;
            const xAngleDeg = THREE.MathUtils.radToDeg(xAngle);
            
            // Apply custom limits if enabled
            if (useCustomZero) {
                // Calculate calibrated angle with limits
                const calibratedAngle = calibrateAngle(xAngleDeg, 'arm1X');
                // Apply limits to the calibrated angle
                const limitedAngle = Math.max(CUSTOM_LIMITS.arm1X.min, 
                                           Math.min(CUSTOM_LIMITS.arm1X.max, calibratedAngle));
                
                if (calibratedAngle !== limitedAngle) {
                    console.log(`Arm1 X rotation limited from ${calibratedAngle}° to ${limitedAngle}° (within custom limits)`);
                }
                
                // Update config with the limited angle
                config.arm1RotationX = limitedAngle;
                
                // Convert back to raw angle and apply to the arm
                const rawAngle = decalibrateAngle(limitedAngle, 'arm1X');
                armSegments[0].rotation.x = THREE.MathUtils.degToRad(rawAngle);
            } else {
                // Standard behavior without custom limits
                config.arm1RotationX = calibrateAngle(xAngleDeg, 'arm1X');
            }
            
            console.log(`IK updated arm1 X rotation to ${config.arm1RotationX}° (raw: ${xAngleDeg.toFixed(2)}°)`);
        }
        
        if (!rotationLocks[0].z) {
            // Calculate rotation for Z (left/right)
            const zAngle = Math.atan2(baseToFirstSegment.x, Math.sqrt(baseToFirstSegment.y * baseToFirstSegment.y + baseToFirstSegment.z * baseToFirstSegment.z));
            
            armSegments[0].rotation.z = zAngle;
            const zAngleDeg = THREE.MathUtils.radToDeg(zAngle);
            
            // Apply custom limits if enabled
            if (useCustomZero) {
                // Calculate calibrated angle with limits
                const calibratedAngle = calibrateAngle(zAngleDeg, 'arm1Z');
                // Apply limits to the calibrated angle
                const limitedAngle = Math.max(CUSTOM_LIMITS.arm1Z.min, 
                                           Math.min(CUSTOM_LIMITS.arm1Z.max, calibratedAngle));
                
                if (calibratedAngle !== limitedAngle) {
                    console.log(`Arm1 Z rotation limited from ${calibratedAngle}° to ${limitedAngle}° (within custom limits)`);
                }
                
                // Update config with the limited angle
                config.arm1RotationZ = limitedAngle;
                
                // Convert back to raw angle and apply to the arm
                const rawAngle = decalibrateAngle(limitedAngle, 'arm1Z');
                armSegments[0].rotation.z = THREE.MathUtils.degToRad(rawAngle);
            } else {
                // Standard behavior without custom limits
                config.arm1RotationZ = calibrateAngle(zAngleDeg, 'arm1Z');
            }
            
            console.log(`IK updated arm1 Z rotation to ${config.arm1RotationZ}° (raw: ${zAngleDeg.toFixed(2)}°)`);
        }
    }
    
    // For all other segments
    for (let i = 1; i < armSegments.length; i++) {
        // Get the direction vectors in local space
        const parentWorldMatrix = armSegments[i - 1].matrixWorld;
        const parentWorldRotation = new THREE.Quaternion();
        parentWorldMatrix.decompose(new THREE.Vector3(), parentWorldRotation, new THREE.Vector3());
        
        // Convert world directions to local directions
        const worldDir = pivots[i + 1].clone().sub(pivots[i]);
        const localDir = worldDir.clone().applyQuaternion(parentWorldRotation.invert());
        
        // Only apply rotations if the axis is not locked
        if (!rotationLocks[i].x) {
            // Calculate local rotations
            const xAngle = Math.atan2(localDir.z, localDir.y);
            const xAngleDeg = THREE.MathUtils.radToDeg(xAngle);
            
            // Update config for arm2
            if (i === 1) {
                // Apply custom limits if enabled
                if (useCustomZero) {
                    // Calculate calibrated angle with limits
                    const calibratedAngle = calibrateAngle(xAngleDeg, 'arm2X');
                    // Apply limits to the calibrated angle
                    const limitedAngle = Math.max(CUSTOM_LIMITS.arm2X.min, 
                                               Math.min(CUSTOM_LIMITS.arm2X.max, calibratedAngle));
                    
                    if (calibratedAngle !== limitedAngle) {
                        console.log(`Arm2 X rotation limited from ${calibratedAngle}° to ${limitedAngle}° (within custom limits)`);
                    }
                    
                    // Update config with the limited angle
                    config.arm2RotationX = limitedAngle;
                    
                    // Convert back to raw angle and apply to the arm
                    const rawAngle = decalibrateAngle(limitedAngle, 'arm2X');
                    armSegments[i].rotation.x = THREE.MathUtils.degToRad(rawAngle);
                } else {
                    // Standard behavior without custom limits
                    armSegments[i].rotation.x = xAngle;
                    config.arm2RotationX = calibrateAngle(xAngleDeg, 'arm2X');
                }
                console.log(`IK updated arm2 X rotation to ${config.arm2RotationX}° (raw: ${xAngleDeg.toFixed(2)}°)`);
            }
        }
        
        if (!rotationLocks[i].z) {
            const zAngle = Math.atan2(localDir.x, Math.sqrt(localDir.y * localDir.y + localDir.z * localDir.z));
            const zAngleDeg = THREE.MathUtils.radToDeg(zAngle);
            
            // Apply custom limits if enabled and this is arm2
            if (i === 1) {  // arm2 is index 1
                if (useCustomZero) {
                    // Calculate calibrated angle with limits
                    const calibratedAngle = calibrateAngle(zAngleDeg, 'arm2Z');
                    // Apply limits to the calibrated angle
                    const limitedAngle = Math.max(CUSTOM_LIMITS.arm2Z.min, 
                                               Math.min(CUSTOM_LIMITS.arm2Z.max, calibratedAngle));
                    
                    if (calibratedAngle !== limitedAngle) {
                        console.log(`Arm2 Z rotation limited from ${calibratedAngle}° to ${limitedAngle}° (within custom limits)`);
                    }
                    
                    // Update config with the limited angle
                    config.arm2RotationZ = limitedAngle;
                    
                    // Convert back to raw angle and apply to the arm
                    const rawAngle = decalibrateAngle(limitedAngle, 'arm2Z');
                    armSegments[i].rotation.z = THREE.MathUtils.degToRad(rawAngle);
                } else {
                    // Standard behavior without custom limits
                    armSegments[i].rotation.z = zAngle;
                    config.arm2RotationZ = calibrateAngle(zAngleDeg, 'arm2Z');
                }
                console.log(`IK updated arm2 Z rotation to ${config.arm2RotationZ}° (raw: ${zAngleDeg.toFixed(2)}°)`);
            } else {
                // For other segments (if any)
                armSegments[i].rotation.z = zAngle;
            }
        }
    }
    
    // Update GUI to reflect new angles
    updateGUI();
}

// Camera view functions
function setCameraTopView() {
    // Y-axis view (top-down)
    orbitControls.reset();
    camera.position.set(0, 20, 0);
    camera.lookAt(0, 0, 0);
}

function setCameraSideView() {
    // X-axis view (side)
    orbitControls.reset();
    camera.position.set(20, 5, 0);
    camera.lookAt(0, 5, 0);
}

function setCameraFrontView() {
    // Z-axis view (front)
    orbitControls.reset();
    camera.position.set(0, 5, 20);
    camera.lookAt(0, 5, 0);
}

// GUI setup
const gui = new dat.GUI();
gui.width = 300;

// Base controls
const baseFolder = gui.addFolder('Base Settings');
baseFolder.add(config, 'baseRadius', 0.2, 2).onChange(updateArmGeometry);
baseFolder.add(config, 'baseHeight', 0.5, 3).onChange(updateArmGeometry);
baseFolder.add(config, 'baseRotation', 0, 360).onChange(updateBaseRotation).name('Base Rotation (°)');
baseFolder.open();

// Direct angle controls
const angleFolder = gui.addFolder('Direct Angle Controls');
angleFolder.add(config, 'baseRotation', 0, 360).onChange(updateBaseRotation).name('Base Angle (°)');
angleFolder.add(config, 'arm1RotationX', 0, 360).onChange(updateArm1Rotation).name('Arm1 X Angle (°)');
angleFolder.add(config, 'arm1RotationZ', 0, 360).onChange(updateArm1Rotation).name('Arm1 Z Angle (°)');
angleFolder.add(config, 'arm2RotationX', 0, 360).onChange(updateArm2Rotation).name('Arm2 X Angle (°)');
angleFolder.add(config, 'arm2RotationZ', 0, 360).onChange(updateArm2Rotation).name('Arm2 Z Angle (°)');
angleFolder.open();

// Custom zero position
const zeroFolder = gui.addFolder('Zero Position & Reset');
zeroFolder.add(config, 'setAsZero').name('Set Current as Zero');
zeroFolder.add(config, 'resetZero').name('Reset to Default Zero');
zeroFolder.open();

// Custom rotation limits
const limitsFolder = gui.addFolder('Custom Rotation Limits');
limitsFolder.add(config, 'baseMinLimit', 0, 180).name('Base Min Limit (°)');
limitsFolder.add(config, 'baseMaxLimit', 180, 360).name('Base Max Limit (°)');
limitsFolder.add(config, 'arm1MinLimitX', 0, 180).name('Arm1 X Min Limit (°)');
limitsFolder.add(config, 'arm1MaxLimitX', 180, 360).name('Arm1 X Max Limit (°)');
limitsFolder.add(config, 'arm1MinLimitZ', 0, 180).name('Arm1 Z Min Limit (°)');
limitsFolder.add(config, 'arm1MaxLimitZ', 180, 360).name('Arm1 Z Max Limit (°)');
limitsFolder.add(config, 'arm2MinLimitX', 0, 180).name('Arm2 X Min Limit (°)');
limitsFolder.add(config, 'arm2MaxLimitX', 180, 360).name('Arm2 X Max Limit (°)');
limitsFolder.add(config, 'arm2MinLimitZ', 0, 180).name('Arm2 Z Min Limit (°)');
limitsFolder.add(config, 'arm2MaxLimitZ', 180, 360).name('Arm2 Z Max Limit (°)');
limitsFolder.add(config, 'updateLimits').name('Apply Limits');
limitsFolder.open();

// Segment controls
const segmentFolder = gui.addFolder('Segment Settings');
segmentFolder.add(config, 'segmentLength', 0.5, 5).onChange(updateArmGeometry);
segmentFolder.add(config, 'segmentWidth', 0.1, 1).onChange(updateArmGeometry);
segmentFolder.add(config, 'numSegments', 1, 5).step(1).onChange(updateNumSegments);
segmentFolder.open();

// Control mode
const controlFolder = gui.addFolder('Control Settings');
controlFolder.add(config, 'IKenabled').name('Inverse Kinematics');
controlFolder.add(config, 'addSegment').name('Add Segment');
controlFolder.add(config, 'removeSegment').name('Remove Segment');
controlFolder.add(config, 'resetPosition').name('Reset Position');
controlFolder.open();

// Segment rotation lock controls
const lockFolder = gui.addFolder('Segment Lock Controls');
lockFolder.add({ lockSelected: toggleSelectedSegmentLock }, 'lockSelected').name('Toggle X Lock (Selected)');
lockFolder.add({ lockSelectedZ: toggleSelectedSegmentLockZ }, 'lockSelectedZ').name('Toggle Z Lock (Selected)');
lockFolder.open();

// Camera view controls
const cameraFolder = gui.addFolder('Camera Views');
cameraFolder.add({ topView: setCameraTopView }, 'topView').name('Top View (Y-axis)');
cameraFolder.add({ sideView: setCameraSideView }, 'sideView').name('Side View (X-axis)');
cameraFolder.add({ frontView: setCameraFrontView }, 'frontView').name('Front View (Z-axis)');
cameraFolder.open();

function updateGUI() {
    // Update GUI controllers to reflect current state
    // First update controllers in the main GUI
    for (const controller of gui.__controllers) {
        controller.updateDisplay();
    }
    
    // Then update controllers in each folder
    for (const folderName in gui.__folders) {
        const folder = gui.__folders[folderName];
        for (const controller of folder.__controllers) {
            controller.updateDisplay();
        }
    }
    
    // Update angle control visibility based on rotation locks
    if (armSegments.length > 0) {
        // Find the controllers for arm1
        const arm1XController = gui.__folders['Direct Angle Controls'].__controllers.find(
            c => c.property === 'arm1RotationX');
        const arm1ZController = gui.__folders['Direct Angle Controls'].__controllers.find(
            c => c.property === 'arm1RotationZ');
        
        if (arm1XController) {
            // Disable the controller if X is locked
            if (rotationLocks[0].x) {
                arm1XController.domElement.style.opacity = 0.5;
                arm1XController.domElement.style.pointerEvents = 'none';
            } else {
                arm1XController.domElement.style.opacity = 1;
                arm1XController.domElement.style.pointerEvents = 'auto';
            }
        }
        
        if (arm1ZController) {
            // Disable the controller if Z is locked
            if (rotationLocks[0].z) {
                arm1ZController.domElement.style.opacity = 0.5;
                arm1ZController.domElement.style.pointerEvents = 'none';
            } else {
                arm1ZController.domElement.style.opacity = 1;
                arm1ZController.domElement.style.pointerEvents = 'auto';
            }
        }
    }
    
    if (armSegments.length > 1) {
        // Find the controllers for arm2
        const arm2XController = gui.__folders['Direct Angle Controls'].__controllers.find(
            c => c.property === 'arm2RotationX');
        const arm2ZController = gui.__folders['Direct Angle Controls'].__controllers.find(
            c => c.property === 'arm2RotationZ');
        
        if (arm2XController) {
            // Disable the controller if X is locked
            if (rotationLocks[1].x) {
                arm2XController.domElement.style.opacity = 0.5;
                arm2XController.domElement.style.pointerEvents = 'none';
            } else {
                arm2XController.domElement.style.opacity = 1;
                arm2XController.domElement.style.pointerEvents = 'auto';
            }
        }
        
        if (arm2ZController) {
            // Disable the controller if Z is locked
            if (rotationLocks[1].z) {
                arm2ZController.domElement.style.opacity = 0.5;
                arm2ZController.domElement.style.pointerEvents = 'none';
            } else {
                arm2ZController.domElement.style.opacity = 1;
                arm2ZController.domElement.style.pointerEvents = 'auto';
            }
        }
    }
}

function updateNumSegments() {
    initializeArm();
}

function updateArmGeometry() {
    // Update base geometry
    base.geometry.dispose();
    base.geometry = new THREE.CylinderGeometry(config.baseRadius, config.baseRadius, config.baseHeight, 32);
    
    // Reinitialize arm with new dimensions
    initializeArm();
}

// Set up camera and controls
camera.position.set(0, 5, 10);
camera.lookAt(0, 5, 0);

const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.1;

// Setup raycaster for clicking on arm segments
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedSegment = null;

// Add click event listener to select arm segments
window.addEventListener('click', (event) => {
    if (dragControls.enabled) {
        // Calculate mouse position in normalized device coordinates
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update the raycaster
        raycaster.setFromCamera(mouse, camera);
        
        // Check for intersections with arm segments
        const allObjects = [];
        armSegments.forEach(segment => allObjects.push(segment));
        const intersects = raycaster.intersectObjects(allObjects);
        
        if (intersects.length > 0) {
            // Get the first intersected object
            const intersectedObject = intersects[0].object;
            
            // Find the arm segment index
            const segmentIndex = armSegments.indexOf(intersectedObject);
            if (segmentIndex !== -1) {
                // Select/deselect this segment
                if (selectedSegment === intersectedObject) {
                    // Deselect if already selected
                    selectedSegment.material.emissive.setHex(0x000000);
                    selectedSegment = null;
                } else {
                    // Deselect previous selection
                    if (selectedSegment) {
                        selectedSegment.material.emissive.setHex(0x000000);
                    }
                    
                    // Select new segment
                    selectedSegment = intersectedObject;
                    selectedSegment.material.emissive.setHex(0x333333);
                }
            }
        }
    }
});

// Toggle X axis rotation lock for selected segment
function toggleSelectedSegmentLock() {
    if (selectedSegment) {
        const segmentIndex = armSegments.indexOf(selectedSegment);
        if (segmentIndex !== -1) {
            // Toggle lock status
            rotationLocks[segmentIndex].x = !rotationLocks[segmentIndex].x;
            
            // Visual feedback
            if (rotationLocks[segmentIndex].x) {
                // Locked - add visual indicator (red X axis helper)
                const axisHelper = new THREE.AxesHelper(0.5);
                axisHelper.name = "xLockIndicator";
                // Hide Y and Z axes, only show X in red
                axisHelper.material.setValues({
                    visible: true,
                    linewidth: 3,
                    opacity: 0.8,
                    transparent: true
                });
                selectedSegment.add(axisHelper);
            } else {
                // Unlocked - remove visual indicator
                const indicator = selectedSegment.getObjectByName("xLockIndicator");
                if (indicator) selectedSegment.remove(indicator);
            }
            
            console.log(`Segment ${segmentIndex} X rotation lock: ${rotationLocks[segmentIndex].x}`);
            
            // Update GUI to reflect lock status
            updateGUI();
        }
    }
}

// Toggle Z axis rotation lock for selected segment
function toggleSelectedSegmentLockZ() {
    if (selectedSegment) {
        const segmentIndex = armSegments.indexOf(selectedSegment);
        if (segmentIndex !== -1) {
            // Toggle lock status
            rotationLocks[segmentIndex].z = !rotationLocks[segmentIndex].z;
            
            // Visual feedback
            if (rotationLocks[segmentIndex].z) {
                // Locked - add visual indicator (blue Z axis helper)
                const axisHelper = new THREE.AxesHelper(0.5);
                axisHelper.name = "zLockIndicator";
                axisHelper.rotation.z = Math.PI/2; // Rotate to highlight Z axis
                // Make it blue
                axisHelper.material.setValues({
                    visible: true,
                    linewidth: 3,
                    opacity: 0.8,
                    transparent: true
                });
                selectedSegment.add(axisHelper);
            } else {
                // Unlocked - remove visual indicator
                const indicator = selectedSegment.getObjectByName("zLockIndicator");
                if (indicator) selectedSegment.remove(indicator);
            }
            
            console.log(`Segment ${segmentIndex} Z rotation lock: ${rotationLocks[segmentIndex].z}`);
            
            // Update GUI to reflect lock status
            updateGUI();
        }
    }
}

// Events
dragControls.addEventListener('dragstart', function() {
    orbitControls.enabled = false;
    
    // Store the initial target position for reference
    dragControls.initialTargetPosition = target.position.clone();
    
    // Store the initial base rotation
    dragControls.initialBaseRotation = base.rotation.y;
});

dragControls.addEventListener('dragend', function() {
    orbitControls.enabled = true;
    
    // Clean up our temporary properties
    delete dragControls.initialTargetPosition;
    delete dragControls.initialBaseRotation;
    
    // Sync config values with current arm rotations after dragging
    syncConfigWithArmRotations();
});

dragControls.addEventListener('drag', function() {
    if (config.IKenabled) {
        // Calculate the change in target position in the XZ plane
        if (dragControls.initialTargetPosition) {
            const deltaX = target.position.x - dragControls.initialTargetPosition.x;
            const deltaZ = target.position.z - dragControls.initialTargetPosition.z;
            
            // Only process if there's significant movement
            if (Math.abs(deltaX) > 0.001 || Math.abs(deltaZ) > 0.001) {
                console.log(`Drag delta: X=${deltaX.toFixed(2)}, Z=${deltaZ.toFixed(2)}`);
            }
        }
        
        // Apply inverse kinematics
        applyInverseKinematics();
        
        // Always sync angles during dragging for real-time feedback
        syncConfigWithArmRotations();
    }
});

// Add continuous update of angles in the render loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update controls
    orbitControls.update();
    
    // Update target trail
    updateTargetTrail();
    
    // Add pulsing effect to target
    pulseTarget();
    
    // Keep angle display in sync with arm position
    // Always update, even during dragging for real-time feedback
    syncConfigWithArmRotations();
    
    renderer.render(scene, camera);
}

// Initialize the arm
initializeArm();

// Sequence handling
let sequence = [];
let sequenceIndex = 0;
let sequenceAnimation = null;

document.getElementById('sequenceUpload').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        console.error('No file selected');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        
        // Parse the sequence file - handle both formats:
        // 1. Simple CSV format: baseAngle,arm1Angle,arm2Angle,duration
        // 2. Formatted output with brackets: { baseAngle, arm1Angle, arm2Angle, duration }
        
        // Remove curly braces, extra spaces, and split by lines
        const cleanedText = text.replace(/[{}]/g, '').trim();
        
        sequence = cleanedText.split('\n')
            .filter(line => line.trim() !== '') // Remove empty lines
            .map(line => {
                // Remove any trailing commas and split by commas
                const parts = line.trim().replace(/,\s*$/, '').split(',').map(part => {
                    // Extract numbers from each part
                    const match = part.match(/-?\d+/);
                    return match ? parseInt(match[0]) : 0;
                });
                
                // Format: baseAngle, arm1Angle, arm2Angle, duration
                return { 
                    baseAngle: parts[0] || 0,
                    arm1AngleX: parts[1] || 0, 
                    arm1AngleZ: parts[2] || 0,
                    arm2AngleX: parts[3] || 0,
                    arm2AngleZ: parts[4] || 0,
                    duration: parts[5] || 1000 // Default 1 second if not specified
                };
            })
            .filter(step => !isNaN(step.baseAngle) && !isNaN(step.arm1AngleX) && !isNaN(step.arm1AngleZ) && !isNaN(step.arm2AngleX) && !isNaN(step.arm2AngleZ)); // Filter invalid steps
        
        console.log('Loaded sequence with', sequence.length, 'steps');
        
        if (sequence.length > 0) {
            sequenceIndex = 0;
            
            // Stop any existing animation
            if (sequenceAnimation) {
                clearTimeout(sequenceAnimation);
            }
            
            // Disable IK during sequence playback
            const prevIKState = config.IKenabled;
            config.IKenabled = false;
            updateGUI();
            
            // Play the sequence
            playSequence();
            
            // Restore IK state after sequence completes
            let totalDuration = sequence.reduce((sum, step) => sum + step.duration, 0);
            sequenceAnimation = setTimeout(() => {
                config.IKenabled = prevIKState;
                updateGUI();
                updateTargetToArmTip(); // Sync target with arm
            }, totalDuration + 500);
        }
    };
    
    reader.onerror = (e) => console.error('Error reading file:', e);
    reader.readAsText(file);
});

function playSequence() {
    if (sequence.length > 0 && sequenceIndex < sequence.length) {
        const step = sequence[sequenceIndex];
        
        // Apply angles to base and arm segments
        // Convert calibrated angles back to raw angles for the simulator
        const rawBaseAngle = decalibrateAngle(step.baseAngle, 'base');
        const rawArm1AngleX = decalibrateAngle(step.arm1AngleX, 'arm1X');
        const rawArm1AngleZ = decalibrateAngle(step.arm1AngleZ, 'arm1Z');
        const rawArm2AngleX = decalibrateAngle(step.arm2AngleX, 'arm2X');
        const rawArm2AngleZ = decalibrateAngle(step.arm2AngleZ, 'arm2Z');
        
        // Debug the decalibration
        console.log(`Sequence step ${sequenceIndex+1}/${sequence.length}:`);
        console.log(`Calibrated angles - Base: ${step.baseAngle}°, Arm1 X: ${step.arm1AngleX}°, Arm1 Z: ${step.arm1AngleZ}°, Arm2 X: ${step.arm2AngleX}°, Arm2 Z: ${step.arm2AngleZ}°`);
        console.log(`Calibration offsets - Arm1 X: ${ANGLE_CALIBRATION.arm1}°, Arm1 Z: ${ANGLE_CALIBRATION.arm1}°, Arm2 X: ${ANGLE_CALIBRATION.arm2}°, Arm2 Z: ${ANGLE_CALIBRATION.arm2}°`);
        console.log(`Raw angles for simulator - Base: ${rawBaseAngle.toFixed(2)}°, Arm1 X: ${rawArm1AngleX.toFixed(2)}°, Arm1 Z: ${rawArm1AngleZ.toFixed(2)}°, Arm2 X: ${rawArm2AngleX.toFixed(2)}°, Arm2 Z: ${rawArm2AngleZ.toFixed(2)}°`);
        
        // Apply base rotation with custom limits if needed
        let baseRotationDeg = rawBaseAngle;
        // Apply custom limits to base rotation
        const relativeToCustZero = baseRotationDeg - CUSTOM_ZERO.base;
        const limitedRelative = Math.max(CUSTOM_LIMITS.base.min, 
                                       Math.min(CUSTOM_LIMITS.base.max, relativeToCustZero));
        baseRotationDeg = CUSTOM_ZERO.base + limitedRelative;
        base.rotation.y = THREE.MathUtils.degToRad(baseRotationDeg);
        config.baseRotation = calibrateAngle(baseRotationDeg, 'base');
        
        // Apply to first segment (arm1) with custom limits
        if (armSegments.length >= 1) {
            let arm1RotationDegX = rawArm1AngleX;
            let arm1RotationDegZ = rawArm1AngleZ;
            // Apply custom limits to arm1 rotation
            const relativeToCustZeroX = arm1RotationDegX - CUSTOM_ZERO.arm1X;
            const limitedRelativeX = Math.max(CUSTOM_LIMITS.arm1X.min, 
                                           Math.min(CUSTOM_LIMITS.arm1X.max, relativeToCustZeroX));
            arm1RotationDegX = CUSTOM_ZERO.arm1X + limitedRelativeX;
            
            const relativeToCustZeroZ = arm1RotationDegZ - CUSTOM_ZERO.arm1Z;
            const limitedRelativeZ = Math.max(CUSTOM_LIMITS.arm1Z.min, 
                                           Math.min(CUSTOM_LIMITS.arm1Z.max, relativeToCustZeroZ));
            arm1RotationDegZ = CUSTOM_ZERO.arm1Z + limitedRelativeZ;
            armSegments[0].rotation.x = THREE.MathUtils.degToRad(arm1RotationDegX);
            armSegments[0].rotation.z = THREE.MathUtils.degToRad(arm1RotationDegZ);
            config.arm1RotationX = calibrateAngle(arm1RotationDegX, 'arm1X');
            config.arm1RotationZ = calibrateAngle(arm1RotationDegZ, 'arm1Z');
        }
        
        // Apply to second segment (arm2) with custom limits
        if (armSegments.length >= 2) {
            let arm2RotationDegX = rawArm2AngleX;
            let arm2RotationDegZ = rawArm2AngleZ;
            // Apply custom limits to arm2 rotation
            const relativeToCustZeroX = arm2RotationDegX - CUSTOM_ZERO.arm2X;
            const limitedRelativeX = Math.max(CUSTOM_LIMITS.arm2X.min, 
                                           Math.min(CUSTOM_LIMITS.arm2X.max, relativeToCustZeroX));
            arm2RotationDegX = CUSTOM_ZERO.arm2X + limitedRelativeX;
            
            const relativeToCustZeroZ = arm2RotationDegZ - CUSTOM_ZERO.arm2Z;
            const limitedRelativeZ = Math.max(CUSTOM_LIMITS.arm2Z.min, 
                                           Math.min(CUSTOM_LIMITS.arm2Z.max, relativeToCustZeroZ));
            arm2RotationDegZ = CUSTOM_ZERO.arm2Z + limitedRelativeZ;
            armSegments[1].rotation.x = THREE.MathUtils.degToRad(arm2RotationDegX);
            armSegments[1].rotation.z = THREE.MathUtils.degToRad(arm2RotationDegZ);
            config.arm2RotationX = calibrateAngle(arm2RotationDegX, 'arm2X');
            config.arm2RotationZ = calibrateAngle(arm2RotationDegZ, 'arm2Z');
        }
        
        // Update target position to match arm
        updateTargetToArmTip();
        // Update angles display
        syncConfigWithArmRotations();
        updateGUI();
        
        console.log(`Playing step ${sequenceIndex+1}/${sequence.length}: Base=${step.baseAngle}° (raw: ${Math.round(rawBaseAngle)}°), Arm1 X: ${step.arm1AngleX}° (raw: ${Math.round(rawArm1AngleX)}°), Arm1 Z: ${step.arm1AngleZ}° (raw: ${Math.round(rawArm1AngleZ)}°), Arm2 X: ${step.arm2AngleX}° (raw: ${Math.round(rawArm2AngleX)}°), Arm2 Z: ${step.arm2AngleZ}° (raw: ${Math.round(rawArm2AngleZ)}°), Duration=${step.duration}ms`);
        
        sequenceIndex++;
        // Use the duration from the sequence data
        setTimeout(playSequence, step.duration);
    } else {
        // Reset for next play
        sequenceIndex = 0;
        console.log('Sequence playback complete');
    }
}

// Add a pulsing effect to make the target more noticeable
function pulseTarget() {
    const time = Date.now() * 0.001; // Convert to seconds
    const scale = 1 + 0.2 * Math.sin(time * 4); // Pulsing scale between 0.8 and 1.2
    
    target.scale.set(scale, scale, scale);
    
    // Also pulse the outline in counter-phase for extra visibility
    if (targetOutline) {
        const outlineScale = 1 + 0.1 * Math.sin(time * 4 + Math.PI); // Opposite phase
        targetOutline.scale.set(outlineScale, outlineScale, outlineScale);
    }
}

// Update target trail in animation loop
function updateTargetTrail() {
    // Only update if the trail exists and has children
    if (targetTrail && targetTrail.children.length > 0) {
        for (let i = 0; i < targetTrail.children.length; i++) {
            targetTrail.children[i].position.copy(target.position);
        }
    }
}

animate();

// Resize handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});