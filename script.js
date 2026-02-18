// Reusable function to apply WebGL distortion to a text element
function initTextDistortionForElement(selector) {
    const textElement = document.querySelector(selector);
    if (!textElement) {
        console.error(`Text element with selector "${selector}" not found`);
        return;
    }

    // Create container for WebGL - wrap the text element
    const container = document.createElement("div");
    container.className = "text-distortion-container";
    container.style.position = "relative";
    container.style.display = "inline-block";
    container.style.cursor = "pointer";
    container.setAttribute("data-webgl-container", "");
    container.setAttribute("data-distortion-strength", "0.08");

    // Create canvas for WebGL
    const canvas = document.createElement("canvas");
    canvas.className = "g_canvas_distortion";
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "10";

    // Measure element BEFORE wrapping (while it's still in original position)
    const originalRect = textElement.getBoundingClientRect();
    const originalDisplay = window.getComputedStyle(textElement).display;
    const originalPosition = window.getComputedStyle(textElement).position;
    
    // Set container size immediately to prevent layout shift
    const containerWidth = originalRect.width || 0;
    const containerHeight = originalRect.height || 0;
    
    // Set canvas size immediately to match container
    const canvasScale = window.devicePixelRatio || 1;
    canvas.width = containerWidth * canvasScale;
    canvas.height = containerHeight * canvasScale;
    canvas.style.width = containerWidth + "px";
    canvas.style.height = containerHeight + "px";
    
    // Wrap the text element
    textElement.parentNode.insertBefore(container, textElement);
    container.appendChild(textElement);
    container.appendChild(canvas);
    
    // Preserve original element's display and positioning
    if (originalDisplay && originalDisplay !== 'inline' && originalDisplay !== 'inline-block') {
        container.style.display = originalDisplay;
    }
    if (originalPosition && originalPosition !== 'static') {
        container.style.position = originalPosition;
    }
    
    // Set container size
    if (containerWidth > 0 && containerHeight > 0) {
        container.style.width = containerWidth + "px";
        container.style.height = containerHeight + "px";
    }
    
    // Don't hide text yet - wait until WebGL is ready

    // Settings
    const settings = {
        falloff: 0.18,
        alpha: 0.08,
        dissipation: 0.965,
        distortionStrength: parseFloat(container.dataset.distortionStrength) || 0.08,
        chromaticAberration: 0.004,
        chromaticSpread: 5,
        velocityScale: 0.6,
        velocityDamping: 0.85,
        mouseRadius: 0.18,
        motionBlurStrength: 0.35,
        motionBlurDecay: 0.88,
        motionBlurThreshold: 0.5
    };

    // Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: false,
        preserveDrawingBuffer: false
    });
    renderer.setClearColor(0, 0);

    // Mouse tracking
    const mouse = {
        current: new THREE.Vector2(-1, -1),
        target: new THREE.Vector2(-1, -1),
        velocity: new THREE.Vector2(0, 0),
        lastPosition: new THREE.Vector2(-1, -1),
        smoothVelocity: new THREE.Vector2(0, 0)
    };

    let flowmapA, flowmapB, displayA, displayB;
    let textTexture, flowmapMaterial, distortionMaterial, flowmapMesh;
    let isInitialized = false;
    let isFirstFrame = true;
    let textCanvas, textCtx;
    let originalElementRect = originalRect; // Store original dimensions

    function renderTextToCanvas() {
        // Check if element contains an image
        const imgElement = textElement.querySelector('img');
        
        if (imgElement) {
            // Handle image element
            loadImageTexture(imgElement);
        } else {
            // Handle text element
            renderTextFallback();
        }
    }
    
    function loadImageTexture(imgElement) {
        // Get image source
        const imgSrc = imgElement.src || imgElement.getAttribute('src');
        
        if (!imgSrc) {
            console.error("Image element has no source");
            textElement.style.opacity = "1"; // Show original if failed
            return;
        }
        
        // Wait for image to load if it hasn't already
        if (imgElement.complete && imgElement.naturalWidth > 0) {
            // Image already loaded
            processImageTexture(imgElement);
        } else {
            // Wait for image to load
            imgElement.onload = function() {
                processImageTexture(imgElement);
            };
            imgElement.onerror = function() {
                console.error("Failed to load image:", imgSrc);
                textElement.style.opacity = "1"; // Show original if failed
            };
            
            // If image is already in the process of loading, trigger load
            if (imgElement.src && !imgElement.complete) {
                // Image will trigger onload when ready
            } else {
                // Try to load it
                processImageTexture(imgElement);
            }
        }
    }
    
    function processImageTexture(imgElement) {
        // Get image source
        const imgSrc = imgElement.src || imgElement.getAttribute('src');
        
        // Create image loader
        const loader = new THREE.TextureLoader();
        loader.crossOrigin = 'anonymous';
        
        loader.load(
            imgSrc,
            // onLoad
            function(texture) {
                textTexture = texture;
                textTexture.minFilter = THREE.LinearFilter;
                textTexture.magFilter = THREE.LinearFilter;
                textTexture.wrapS = THREE.ClampToEdgeWrapping;
                textTexture.wrapT = THREE.ClampToEdgeWrapping;
                
                // Use original element dimensions for container (already set, but ensure they're correct)
                const containerWidth = originalElementRect.width || imgElement.offsetWidth || imgElement.naturalWidth || 100;
                const containerHeight = originalElementRect.height || imgElement.offsetHeight || imgElement.naturalHeight || 100;
                
                // Update container size if needed
                if (container.style.width !== containerWidth + "px") {
                    container.style.width = containerWidth + "px";
                }
                if (container.style.height !== containerHeight + "px") {
                    container.style.height = containerHeight + "px";
                }
                
                // Update WebGL canvas size to match container exactly
                const canvasScale = window.devicePixelRatio || 1;
                if (canvas.width !== containerWidth * canvasScale) {
                    canvas.width = containerWidth * canvasScale;
                }
                if (canvas.height !== containerHeight * canvasScale) {
                    canvas.height = containerHeight * canvasScale;
                }
                canvas.style.width = containerWidth + "px";
                canvas.style.height = containerHeight + "px";
                
                onTextureLoaded();
            },
            // onProgress (optional)
            undefined,
            // onError
            function(error) {
                console.error("Failed to load image texture:", error);
                textElement.style.opacity = "1"; // Show original if failed
            }
        );
    }
    
    function renderTextFallback() {
        // Get computed styles
        const computedStyle = window.getComputedStyle(textElement);
        const fontSize = computedStyle.fontSize;
        const fontFamily = computedStyle.fontFamily;
        const fontWeight = computedStyle.fontWeight;
        let color = computedStyle.color;
        
        // Handle gradient text (background-clip: text makes color transparent)
        // Check if element has gradient background
        const backgroundImage = computedStyle.backgroundImage;
        const isGradientText = color === 'transparent' || color === 'rgba(0, 0, 0, 0)' || backgroundImage !== 'none';
        
        // For gradient text, use a white/light color as fallback
        if (isGradientText) {
            // Try to extract gradient colors or use white
            if (backgroundImage.includes('gradient')) {
                // Approximate gradient with white/light gray
                color = 'rgba(255, 255, 255, 0.7)';
            } else {
                color = 'rgba(255, 255, 255, 0.7)';
            }
        }
        
        // Use textContent which will include superscript text (like "Encore™ Series")
        const textContent = textElement.textContent || textElement.innerText;

        // Create offscreen canvas for text rendering
        textCanvas = document.createElement("canvas");
        textCtx = textCanvas.getContext("2d");

        // First, set font to measure text accurately
        textCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        const textMetrics = textCtx.measureText(textContent);
        
        // Get actual text dimensions
        const actualTextWidth = textMetrics.width;
        const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(fontSize) * 1.2;
        const actualTextHeight = lineHeight;
        
        // Use the larger of: original element size or actual text size
        // This ensures we capture the full text even if element has extra space
        let textWidth = Math.max(originalElementRect.width || 0, actualTextWidth);
        let textHeight = Math.max(originalElementRect.height || 0, actualTextHeight);
        
        // Fallback if both are 0
        if (textWidth === 0) textWidth = actualTextWidth || 100;
        if (textHeight === 0) textHeight = actualTextHeight || 50;

        // Set canvas size to match container exactly
        const scale = window.devicePixelRatio || 2; // Use higher scale for better quality
        textCanvas.width = textWidth * scale;
        textCanvas.height = textHeight * scale;
        textCtx.scale(scale, scale);

        // Clear canvas (transparent background)
        textCtx.clearRect(0, 0, textWidth, textHeight);

        // Set text properties again after scaling
        textCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        textCtx.fillStyle = color;
        textCtx.textAlign = "left";
        textCtx.textBaseline = "alphabetic";

        // Position text to match original element's text position
        // Text should start at left edge (x = 0)
        // For Y, we need to account for the baseline
        // The baseline is typically around 0.8 * fontSize from the top
        const textX = 0;
        // Calculate Y to center the text vertically based on line height
        const textY = (textHeight - actualTextHeight) / 2 + parseFloat(fontSize) * 0.8;
        
        // Draw text
        textCtx.fillText(textContent, textX, textY);

        // Create texture from canvas
        textTexture = new THREE.CanvasTexture(textCanvas);
        textTexture.minFilter = THREE.LinearFilter;
        textTexture.magFilter = THREE.LinearFilter;
        textTexture.wrapS = THREE.ClampToEdgeWrapping;
        textTexture.wrapT = THREE.ClampToEdgeWrapping;
        textTexture.needsUpdate = true;

        // Container and canvas should already be sized correctly
        // Just ensure they match the text dimensions
        const containerWidth = originalElementRect.width || textWidth;
        const containerHeight = originalElementRect.height || textHeight;
        
        // Update container if needed
        if (container.style.width !== containerWidth + "px") {
            container.style.width = containerWidth + "px";
        }
        if (container.style.height !== containerHeight + "px") {
            container.style.height = containerHeight + "px";
        }

        // Update WebGL canvas size to match container exactly
        const canvasScale = window.devicePixelRatio || 1;
        if (canvas.width !== containerWidth * canvasScale) {
            canvas.width = containerWidth * canvasScale;
        }
        if (canvas.height !== containerHeight * canvasScale) {
            canvas.height = containerHeight * canvasScale;
        }
        canvas.style.width = containerWidth + "px";
        canvas.style.height = containerHeight + "px";

        onTextureLoaded();
    }

    function onTextureLoaded() {
        if (!textTexture) {
            console.error("Failed to create texture for", selector);
            // Show original element if WebGL fails
            textElement.style.opacity = "1";
            return;
        }
        
        createMaterials();
        createRenderTargets();
        createMesh();
        setupEventListeners();
        onResize();
        isInitialized = true;
        animate();
        
        // Hide original element (text or image) now that WebGL is ready
        textElement.style.opacity = "0";
        textElement.style.pointerEvents = "none";
        
        // Also hide any images inside the element
        const imgElement = textElement.querySelector('img');
        if (imgElement) {
            imgElement.style.opacity = "0";
            imgElement.style.pointerEvents = "none";
        }
    }

    function createMaterials() {
        flowmapMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: flowmapFragment,
            uniforms: {
                uMouse: { value: mouse.current.clone() },
                uVelocity: { value: mouse.velocity.clone() },
                uResolution: { value: new THREE.Vector2() },
                uFalloff: { value: settings.falloff },
                uAlpha: { value: settings.alpha },
                uDissipation: { value: settings.dissipation },
                uAspect: { value: 1 },
                uTexture: { value: null }
            }
        });

        distortionMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: distortionFragment,
            uniforms: {
                uLogo: { value: textTexture },
                uFlowmap: { value: null },
                uPreviousFrame: { value: null },
                uImageScale: { value: new THREE.Vector2(1, 1) },
                uImageOffset: { value: new THREE.Vector2(0, 0) },
                uDistortionStrength: { value: settings.distortionStrength },
                uChromaticAberration: { value: settings.chromaticAberration },
                uChromaticSpread: { value: settings.chromaticSpread },
                uResolution: { value: new THREE.Vector2() },
                uMotionBlurStrength: { value: settings.motionBlurStrength },
                uMotionBlurDecay: { value: settings.motionBlurDecay },
                uMotionBlurThreshold: { value: settings.motionBlurThreshold },
                uIsFirstFrame: { value: true }
            },
            transparent: true
        });
    }

    function createRenderTargets() {
        const type = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
        const options = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: type
        };

        const flowmapSize = 128;
        flowmapA = new THREE.WebGLRenderTarget(flowmapSize, flowmapSize, options);
        flowmapB = new THREE.WebGLRenderTarget(flowmapSize, flowmapSize, options);

        const displayWidth = Math.min(container.clientWidth, 512);
        const displayHeight = Math.min(container.clientHeight, 512);
        displayA = new THREE.WebGLRenderTarget(displayWidth, displayHeight, options);
        displayB = new THREE.WebGLRenderTarget(displayWidth, displayHeight, options);
    }

    function createMesh() {
        const geometry = new THREE.PlaneGeometry(2, 2);
        flowmapMesh = new THREE.Mesh(geometry, flowmapMaterial);
    }

    function setupEventListeners() {
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mouseenter', onMouseEnter);
        container.addEventListener('mouseleave', onMouseLeave);
        container.addEventListener('touchstart', onTouchStart, { passive: true });
        container.addEventListener('touchmove', onTouchMove, { passive: true });
        container.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('resize', onResize);
    }

    function getMousePosition(clientX, clientY) {
        const rect = container.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / rect.width,
            y: 1 - (clientY - rect.top) / rect.height
        };
    }

    function onMouseMove(event) {
        const pos = getMousePosition(event.clientX, event.clientY);
        updateMouseTarget(pos.x, pos.y);
    }

    function onMouseEnter(event) {
        const pos = getMousePosition(event.clientX, event.clientY);
        mouse.current.set(pos.x, pos.y);
        mouse.target.set(pos.x, pos.y);
        mouse.lastPosition.set(pos.x, pos.y);
    }

    function onMouseLeave() {
        mouse.target.set(-1, -1);
    }

    function onTouchStart(event) {
        if (event.touches.length > 0) {
            const touch = event.touches[0];
            const pos = getMousePosition(touch.clientX, touch.clientY);
            mouse.current.set(pos.x, pos.y);
            mouse.target.set(pos.x, pos.y);
            mouse.lastPosition.set(pos.x, pos.y);
        }
    }

    function onTouchMove(event) {
        if (event.touches.length > 0) {
            const touch = event.touches[0];
            const pos = getMousePosition(touch.clientX, touch.clientY);
            updateMouseTarget(pos.x, pos.y);
        }
    }

    function onTouchEnd() {
        mouse.target.set(-1, -1);
    }

    function updateMouseTarget(x, y) {
        mouse.target.set(x, y);
    }

    function updateMouse() {
        mouse.lastPosition.copy(mouse.current);
        mouse.current.lerp(mouse.target, 0.7);

        const deltaX = mouse.current.x - mouse.lastPosition.x;
        const deltaY = mouse.current.y - mouse.lastPosition.y;
        const delta = new THREE.Vector2(deltaX, deltaY);

        delta.multiplyScalar(80);
        mouse.velocity.lerp(delta, 0.6);
        mouse.smoothVelocity.lerp(mouse.velocity, 0.3);
        mouse.velocity.multiplyScalar(settings.velocityDamping);
    }

    function onResize() {
        const { clientWidth, clientHeight } = container;
        if (clientWidth === 0 || clientHeight === 0) return;
        
        renderer.setSize(clientWidth, clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const aspect = clientWidth / clientHeight;
        
        if (flowmapMaterial) {
            flowmapMaterial.uniforms.uResolution.value.set(clientWidth, clientHeight);
            flowmapMaterial.uniforms.uAspect.value = aspect;
        }

        if (distortionMaterial) {
            if (distortionMaterial.uniforms.uResolution) {
                distortionMaterial.uniforms.uResolution.value.set(clientWidth, clientHeight);
            }
            updateImageScale(clientWidth, clientHeight);
        }

        if (displayA && displayB) {
            const displayWidth = Math.min(clientWidth, 512);
            const displayHeight = Math.min(clientHeight, 512);
            displayA.setSize(displayWidth, displayHeight);
            displayB.setSize(displayWidth, displayHeight);
        }
    }

    function updateImageScale(canvasWidth, canvasHeight) {
        if (!textTexture) return;

        const imageWidth = textTexture.image.width;
        const imageHeight = textTexture.image.height;
        const imageAspect = imageWidth / imageHeight;
        const canvasAspect = canvasWidth / canvasHeight;

        let scaleX, scaleY;
        
        if (imageAspect > canvasAspect) {
            scaleX = 1;
            scaleY = canvasAspect / imageAspect;
        } else {
            scaleX = imageAspect / canvasAspect;
            scaleY = 1;
        }

        distortionMaterial.uniforms.uImageScale.value.set(scaleX, scaleY);
        distortionMaterial.uniforms.uImageOffset.value.set(0, 0);
    }

    function render() {
        if (!isInitialized) return;

        const { clientWidth, clientHeight } = container;
        if (clientWidth === 0 || clientHeight === 0) return;
        if (document.hidden) return;

        updateMouse();

        // Update flowmap uniforms
        flowmapMaterial.uniforms.uMouse.value.copy(mouse.current);
        flowmapMaterial.uniforms.uVelocity.value.copy(mouse.smoothVelocity);
        flowmapMaterial.uniforms.uVelocity.value.multiplyScalar(settings.velocityScale);

        // Render flowmap
        flowmapMesh.material = flowmapMaterial;
        flowmapMaterial.uniforms.uTexture.value = flowmapB.texture;
        renderer.setRenderTarget(flowmapA);
        renderer.render(flowmapMesh, camera);

        // Render distortion
        flowmapMesh.material = distortionMaterial;
        distortionMaterial.uniforms.uFlowmap.value = flowmapA.texture;
        distortionMaterial.uniforms.uPreviousFrame.value = displayB.texture;
        distortionMaterial.uniforms.uIsFirstFrame.value = isFirstFrame;
        renderer.setRenderTarget(displayA);
        renderer.render(flowmapMesh, camera);

        // Render to screen
        renderer.setRenderTarget(null);
        renderer.render(flowmapMesh, camera);

        // Swap render targets
        [flowmapA, flowmapB] = [flowmapB, flowmapA];
        [displayA, displayB] = [displayB, displayA];
        
        isFirstFrame = false;
    }

    function animate() {
        render();
        requestAnimationFrame(animate);
    }

    // Start initialization
    renderTextToCanvas();
}

// Initialize all text distortions
function initAllTextDistortions() {
    // Initialize for each element with a small delay between them
    // to ensure proper measurement
    initTextDistortionForElement(".hero__sub-heading");
    
    setTimeout(() => {
        initTextDistortionForElement(".hero__heading");
    }, 50);
    
    setTimeout(() => {
        initTextDistortionForElement(".fifth__section__watermark");
    }, 100);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for fonts and layout to be ready
    function init() {
        // Force a reflow to ensure elements are measured correctly
        document.body.offsetHeight;
        setTimeout(initAllTextDistortions, 100);
    }
    
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            init();
        });
    } else {
        setTimeout(init, 300);
    }
});
