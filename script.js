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
    // Force a reflow to ensure accurate measurements
    textElement.offsetHeight;
    const originalRect = textElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(textElement);
    const originalDisplay = computedStyle.display;
    const originalPosition = computedStyle.position;
    const originalWidth = computedStyle.width;
    const originalHeight = computedStyle.height;
    
    // Set container size immediately to prevent layout shift
    // Use actual rendered dimensions
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
    
    // Preserve ALL positioning and layout properties from original element
    const originalLeft = computedStyle.left;
    const originalRight = computedStyle.right;
    const originalTop = computedStyle.top;
    const originalBottom = computedStyle.bottom;
    const originalTransform = computedStyle.transform;
    const originalMargin = computedStyle.margin;
    const originalMarginTop = computedStyle.marginTop;
    const originalMarginRight = computedStyle.marginRight;
    const originalMarginBottom = computedStyle.marginBottom;
    const originalMarginLeft = computedStyle.marginLeft;
    
    // Preserve original element's display and positioning
    if (originalDisplay && originalDisplay !== 'inline' && originalDisplay !== 'inline-block') {
        container.style.display = originalDisplay;
    }
    if (originalPosition && originalPosition !== 'static') {
        container.style.position = originalPosition;
    }
    
    // Preserve all positioning properties
    if (originalLeft && originalLeft !== 'auto') container.style.left = originalLeft;
    if (originalRight && originalRight !== 'auto') container.style.right = originalRight;
    if (originalTop && originalTop !== 'auto') container.style.top = originalTop;
    if (originalBottom && originalBottom !== 'auto') container.style.bottom = originalBottom;
    if (originalTransform && originalTransform !== 'none') container.style.transform = originalTransform;
    
    // Preserve margin properties
    if (originalMargin && originalMargin !== '0px') {
        container.style.margin = originalMargin;
    } else {
        if (originalMarginTop && originalMarginTop !== '0px') container.style.marginTop = originalMarginTop;
        if (originalMarginRight && originalMarginRight !== '0px') container.style.marginRight = originalMarginRight;
        if (originalMarginBottom && originalMarginBottom !== '0px') container.style.marginBottom = originalMarginBottom;
        if (originalMarginLeft && originalMarginLeft !== '0px') container.style.marginLeft = originalMarginLeft;
    }
    
    // Preserve width/height - use percentage if original was percentage
    if (originalWidth && originalWidth !== 'auto' && originalWidth.includes('%')) {
        container.style.width = originalWidth;
    } else if (containerWidth > 0) {
        container.style.width = containerWidth + "px";
    }
    if (originalHeight && originalHeight !== 'auto' && originalHeight.includes('%')) {
        container.style.height = originalHeight;
    } else if (containerHeight > 0) {
        container.style.height = containerHeight + "px";
    }
    
    // Reset positioning on inner element
    textElement.style.position = 'static';
    textElement.style.left = 'auto';
    textElement.style.right = 'auto';
    textElement.style.top = 'auto';
    textElement.style.bottom = 'auto';
    textElement.style.transform = 'none';
    textElement.style.margin = '0';
    
    // Don't hide text yet - wait until WebGL is ready

    // Settings - will be adjusted for images
    const settings = {
        falloff: 0.18,
        alpha: 0.1,
        dissipation: 0.965,
        distortionStrength: parseFloat(container.dataset.distortionStrength) || 0.08,
        chromaticAberration: 0.0,
        chromaticSpread: 5,
        velocityScale: 0.6,
        velocityDamping: 0.85,
        mouseRadius: 0.18,
        motionBlurStrength: 0.2, // Reduced to preserve color accuracy
        motionBlurDecay: 0.9, // Increased to reduce fading
        motionBlurThreshold: 0.5
    };
    
    // For image elements, disable motion blur to prevent color fading
    const imgElement = textElement.querySelector('img');
    if (imgElement) {
        settings.motionBlurStrength = 0.0; // Disable motion blur for images
        settings.dissipation = 0.99; // Increase dissipation to reduce flow accumulation and prevent fading
    }

    // Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance"
    });
    renderer.setClearColor(0, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
    let isImageElement = false; // Track if this is an image element

    function renderTextToCanvas() {
        // Check if element contains an image
        const imgElement = textElement.querySelector('img');
        
        if (imgElement) {
            // Handle image element
            isImageElement = true;
            loadImageTexture(imgElement);
        } else {
            // Handle text element
            isImageElement = false;
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
                // Use better filters for higher quality
                textTexture.minFilter = THREE.LinearMipmapLinearFilter;
                textTexture.magFilter = THREE.LinearFilter;
                textTexture.wrapS = THREE.ClampToEdgeWrapping;
                textTexture.wrapT = THREE.ClampToEdgeWrapping;
                // Generate mipmaps for better quality
                textTexture.generateMipmaps = true;
                // Ensure proper color space (sRGB) - for Three.js r128 use encoding
                if (THREE.SRGBColorSpace !== undefined) {
                    textTexture.colorSpace = THREE.SRGBColorSpace;
                } else if (THREE.sRGBEncoding !== undefined) {
                    textTexture.encoding = THREE.sRGBEncoding;
                }
                // Ensure texture is updated
                textTexture.needsUpdate = true;
                
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
                
                // Update WebGL canvas size to match container with higher quality
                // Use higher pixel ratio for better quality (max 2 for performance)
                const canvasScale = Math.min(window.devicePixelRatio || 2, 2);
                if (canvas.width !== containerWidth * canvasScale) {
                    canvas.width = containerWidth * canvasScale;
                }
                if (canvas.height !== containerHeight * canvasScale) {
                    canvas.height = containerHeight * canvasScale;
                }
                canvas.style.width = containerWidth + "px";
                canvas.style.height = containerHeight + "px";
                
                // Update renderer size and pixel ratio
                renderer.setSize(containerWidth * canvasScale, containerHeight * canvasScale);
                renderer.setPixelRatio(canvasScale);
                
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
    
    function renderTextWithSuperscripts(element, ctx, startX, baseY, baseFontSize, fontWeight, fontFamily, color, textAlign, canvasWidth) {
        // Clone the element to work with its structure
        const clone = element.cloneNode(true);
        
        // Set base font
        ctx.font = `${fontWeight} ${baseFontSize} ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        
        let x = startX;
        const superscriptFontSize = parseFloat(baseFontSize) * 0.5; // 0.5em as per CSS
        // Smaller vertical offset for superscript to match CSS vertical-align: super
        const superscriptOffset = parseFloat(baseFontSize) * 0.3;
        
        // Recursively process child nodes
        function processNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                // Regular text node
                const text = node.textContent;
                if (text) {
                    ctx.font = `${fontWeight} ${baseFontSize} ${fontFamily}`;
                    ctx.fillText(text, x, baseY);
                    const metrics = ctx.measureText(text);
                    x += metrics.width;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Element node - check if it's a superscript
                if (node.tagName === 'SUP' || node.classList.contains('tm')) {
                    // Render superscript text
                    const supText = node.textContent;
                    if (supText) {
                        ctx.font = `${fontWeight} ${superscriptFontSize}px ${fontFamily}`;
                        ctx.fillText(supText, x, baseY - superscriptOffset);
                        const metrics = ctx.measureText(supText);
                        x += metrics.width;
                    }
                } else {
                    // Process child nodes recursively
                    Array.from(node.childNodes).forEach(child => processNode(child));
                }
            }
        }
        
        // Process all child nodes
        Array.from(clone.childNodes).forEach(child => processNode(child));
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
        
        // Check if element has superscripts or other HTML formatting
        const hasSuperscripts = textElement.querySelector('sup') !== null;
        
        // Create offscreen canvas for text rendering
        textCanvas = document.createElement("canvas");
        textCtx = textCanvas.getContext("2d");

        // ALWAYS use the original element dimensions for text canvas
        // This is critical for elements with width: 100% or large font sizes
        let textWidth = originalElementRect.width;
        let textHeight = originalElementRect.height;
        
        // If dimensions are 0, measure text as fallback
        if (textWidth === 0 || textHeight === 0) {
            const textContent = textElement.textContent || textElement.innerText;
            textCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
            const textMetrics = textCtx.measureText(textContent);
            const actualTextWidth = textMetrics.width;
            const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(fontSize) * 1.2;
            const actualTextHeight = lineHeight;
            
            if (textWidth === 0) textWidth = actualTextWidth || 100;
            if (textHeight === 0) textHeight = actualTextHeight || 50;
        }
        
        // Ensure we have valid dimensions
        if (textWidth === 0) textWidth = 100;
        if (textHeight === 0) textHeight = 50;

        // Set canvas size to match container exactly
        const scale = window.devicePixelRatio || 2; // Use higher scale for better quality
        textCanvas.width = textWidth * scale;
        textCanvas.height = textHeight * scale;
        textCtx.scale(scale, scale);

        // Clear canvas (transparent background)
        textCtx.clearRect(0, 0, textWidth, textHeight);

        // Set base text properties
        textCtx.fillStyle = color;
        textCtx.textBaseline = "alphabetic";
        textCtx.textAlign = "left";

        // Calculate base Y position for text
        // Get padding values (but most elements won't have padding)
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
        const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(fontSize) * 1.2;
        textCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        
        // Calculate content area (excluding padding)
        const contentWidth = textWidth - paddingLeft - paddingRight;
        const contentHeight = textHeight - paddingTop - (parseFloat(computedStyle.paddingBottom) || 0);
        
        // For alphabetic baseline, center text vertically
        // Use a simpler calculation: center of content area + baseline adjustment
        const baseTextY = paddingTop + (contentHeight / 2) + (parseFloat(fontSize) * 0.35);
        
        // Check text-align property
        const textAlign = computedStyle.textAlign || 'left';
        let currentX = 0; // Start at 0, will add padding only if needed
        
        if (textAlign === 'center') {
            textCtx.textAlign = 'center';
            // Will calculate center position after measuring all text
        } else if (textAlign === 'right') {
            textCtx.textAlign = 'right';
            // Will calculate right position after measuring all text
        } else {
            textCtx.textAlign = 'left';
            currentX = paddingLeft; // Only add padding if it exists
        }

        // Render text with superscripts if present
        if (hasSuperscripts) {
            // First measure total width for centering/right alignment
            let totalWidth = 0;
            const clone = textElement.cloneNode(true);
            textCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
            const superscriptFontSize = parseFloat(fontSize) * 0.5;
            
            function measureNode(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent;
                    if (text) {
                        textCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
                        totalWidth += textCtx.measureText(text).width;
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'SUP' || node.classList.contains('tm')) {
                        const supText = node.textContent;
                        if (supText) {
                            textCtx.font = `${fontWeight} ${superscriptFontSize}px ${fontFamily}`;
                            totalWidth += textCtx.measureText(supText).width;
                        }
                    } else {
                        Array.from(node.childNodes).forEach(child => measureNode(child));
                    }
                }
            }
            Array.from(clone.childNodes).forEach(child => measureNode(child));
            
            // Calculate starting X based on alignment
            // Account for padding in the content area
            const contentWidth = textWidth - paddingLeft - paddingRight;
            let startX = paddingLeft; // Default to padding for left align
            
            if (textAlign === 'center') {
                startX = paddingLeft + (contentWidth - totalWidth) / 2;
            } else if (textAlign === 'right') {
                startX = paddingLeft + contentWidth - totalWidth;
            } else {
                // Left align - start at padding
                startX = paddingLeft;
            }
            
            // Render text with superscripts
            renderTextWithSuperscripts(textElement, textCtx, startX, baseTextY, fontSize, fontWeight, fontFamily, color, textAlign, textWidth);
        } else {
            // Simple text rendering without superscripts
            const textContent = textElement.textContent || textElement.innerText;
            textCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
            
            // Calculate text X position accounting for padding
            const contentWidth = textWidth - paddingLeft - paddingRight;
            let textX = currentX;
            
            if (textAlign === 'center') {
                const textMetrics = textCtx.measureText(textContent);
                textX = paddingLeft + (contentWidth / 2);
                textCtx.textAlign = 'center';
            } else if (textAlign === 'right') {
                textX = paddingLeft + contentWidth;
                textCtx.textAlign = 'right';
            } else {
                // Left align - use currentX which already includes padding
                textX = currentX;
            }
            
            textCtx.fillText(textContent, textX, baseTextY);
        }

        // Create texture from canvas
        textTexture = new THREE.CanvasTexture(textCanvas);
        textTexture.minFilter = THREE.LinearFilter;
        textTexture.magFilter = THREE.LinearFilter;
        textTexture.wrapS = THREE.ClampToEdgeWrapping;
        textTexture.wrapT = THREE.ClampToEdgeWrapping;
        textTexture.needsUpdate = true;

        // Use the text canvas dimensions (which are based on original element size)
        const containerWidth = textWidth;
        const containerHeight = textHeight;
        
        // Update container to match text canvas size exactly
        container.style.width = containerWidth + "px";
        container.style.height = containerHeight + "px";

        // Update WebGL canvas size to match container exactly
        const canvasScale = window.devicePixelRatio || 1;
        canvas.width = containerWidth * canvasScale;
        canvas.height = containerHeight * canvasScale;
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
        // Use higher precision for better color quality
        // For WebGL2, use FloatType for maximum color accuracy (if supported)
        let type = THREE.UnsignedByteType;
        if (renderer.capabilities.isWebGL2) {
            // Try to use FloatType for better color accuracy, fallback to HalfFloatType
            const gl = renderer.getContext();
            if (gl.getExtension('OES_texture_float_linear')) {
                type = THREE.FloatType;
            } else {
                type = THREE.HalfFloatType;
            }
        }
        const options = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: type,
            stencilBuffer: false,
            depthBuffer: false
        };

        const flowmapSize = 128;
        flowmapA = new THREE.WebGLRenderTarget(flowmapSize, flowmapSize, options);
        flowmapB = new THREE.WebGLRenderTarget(flowmapSize, flowmapSize, options);

        // Use higher resolution for display targets to preserve image quality
        // Scale based on device pixel ratio for better quality
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = Math.min(container.clientWidth * pixelRatio, 2048);
        const displayHeight = Math.min(container.clientHeight * pixelRatio, 2048);
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
            // Use higher resolution for better quality
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            const displayWidth = Math.min(clientWidth * pixelRatio, 2048);
            const displayHeight = Math.min(clientHeight * pixelRatio, 2048);
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
    
    // setTimeout(() => {
    //     initTextDistortionForElement(".fifth__section__watermark");
    // }, 100);
   
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


window.addEventListener('resize', function() {
    window.location.reload();
});