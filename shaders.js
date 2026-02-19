// Shader code
const flowmapFragment = `
    uniform vec2 uMouse;
    uniform vec2 uVelocity;
    uniform vec2 uResolution;
    uniform float uFalloff;
    uniform float uAlpha;
    uniform float uDissipation;
    uniform float uAspect;
    uniform sampler2D uTexture;
    
    varying vec2 vUv;
    
    void main() {
        vec2 uv = vUv;
        vec4 color = texture2D(uTexture, uv);
        color.rgb *= uDissipation;
        
        vec2 cursor = uMouse;
        vec2 aspectUv = uv;
        aspectUv.x *= uAspect;
        cursor.x *= uAspect;
        
        float dist = distance(aspectUv, cursor);
        float influence = 1.0 - smoothstep(0.0, uFalloff, dist);
        
        vec2 velocityContribution = vec2(uVelocity.x, -uVelocity.y) * influence * uAlpha;
        color.rg += velocityContribution;
        color.b = length(color.rg) * 2.0;
        
        gl_FragColor = color;
    }
`;

const distortionFragment = `
    uniform sampler2D uLogo;
    uniform sampler2D uFlowmap;
    uniform sampler2D uPreviousFrame;
    uniform vec2 uImageScale;
    uniform vec2 uImageOffset;
    uniform float uDistortionStrength;
    uniform float uChromaticAberration;
    uniform float uChromaticSpread;
    uniform vec2 uResolution;
    uniform float uMotionBlurStrength;
    uniform float uMotionBlurDecay;
    uniform float uMotionBlurThreshold;
    uniform bool uIsFirstFrame;
    
    varying vec2 vUv;

    precision mediump float;
    
    vec2 canvasToImageUV(vec2 uv) {
        vec2 centeredUv = (uv - 0.5);
        centeredUv /= uImageScale;
        centeredUv += uImageOffset;
        return centeredUv + 0.5;
    }
    
    vec4 sampleLogoExtended(vec2 uv) {
        vec2 imageUv = canvasToImageUV(uv);
        
        if (imageUv.x < 0.0 || imageUv.x > 1.0 || imageUv.y < 0.0 || imageUv.y > 1.0) {
            return vec4(0.0, 0.0, 0.0, 0.0);
        }
        
        return texture2D(uLogo, imageUv);
    }
    
    bool isWithinImageBounds(vec2 uv) {
        vec2 imageUv = canvasToImageUV(uv);
        return imageUv.x >= 0.0 && imageUv.x <= 1.0 && imageUv.y >= 0.0 && imageUv.y <= 1.0;
    }
    
    void main() {
        vec2 uv = vUv;
        vec3 flow = texture2D(uFlowmap, uv).rgb;
        float flowMagnitude = length(flow.rg);
        
        vec2 distortedUv = uv + flow.rg * uDistortionStrength;
        
        float aberrationAmount = flow.b * uChromaticAberration;
        vec2 flowDirection = length(flow.rg) > 0.0 ? normalize(flow.rg) : vec2(0.0);
        
        vec2 redOffset = flowDirection * aberrationAmount * uChromaticSpread;
        vec2 greenOffset = vec2(-flowDirection.y, flowDirection.x) * aberrationAmount * uChromaticSpread * 0.8;
        vec2 blueOffset = -flowDirection * aberrationAmount * uChromaticSpread;
        
        vec2 redUv = distortedUv + redOffset;
        vec2 greenUv = distortedUv + greenOffset;
        vec2 blueUv = distortedUv + blueOffset;
        
        float r = sampleLogoExtended(redUv).r;
        float g = sampleLogoExtended(greenUv).g;
        float b = sampleLogoExtended(blueUv).b;
        
        vec4 centerSample = sampleLogoExtended(distortedUv);
        
        float alpha = 0.0;
        if (isWithinImageBounds(redUv)) {
            alpha = max(alpha, sampleLogoExtended(redUv).a);
        }
        if (isWithinImageBounds(greenUv)) {
            alpha = max(alpha, sampleLogoExtended(greenUv).a);
        }
        if (isWithinImageBounds(blueUv)) {
            alpha = max(alpha, sampleLogoExtended(blueUv).a);
        }
        if (isWithinImageBounds(distortedUv)) {
            alpha = max(alpha, centerSample.a);
        }
        
        if (alpha < 0.01) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }
        
        // Preserve original colors - use center sample when no distortion
        vec3 color = centerSample.rgb;
        
        // Only apply chromatic aberration when there's significant flow
        if (flowMagnitude > 0.01 && uChromaticAberration > 0.0) {
            // Use chromatic aberration colors only if they're valid
            float totalBrightness = r + g + b;
            if (totalBrightness > 0.05) {
                color = vec3(r, g, b);
            }
        }
        
        // Minimal color enhancement only on strong flow to preserve original colors
        if (flowMagnitude > 0.1) {
            // Very subtle enhancement, preserve original color balance
            float enhancement = flowMagnitude * 0.1;
            color = mix(centerSample.rgb, color, enhancement);
        }
        
        vec4 currentColor = vec4(color, alpha);
        
        // Completely disable motion blur blending to prevent color fading
        // Only use current frame color, never blend with previous frames
        // This ensures colors stay accurate and don't fade over time
        gl_FragColor = currentColor;
    }
`;

const vertexShader = `
    varying vec2 vUv;
    
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;
