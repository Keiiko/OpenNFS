// Interpolated values from the vertex shaders
in vec2 UV;
flat in uint texIndex;
in vec4 nfsDataOut;
flat in uint debugDataOut;

// Diffuse and Specular
in vec3 surfaceNormal;
in vec3 toLightVector[MAX_TRACK_CONTRIB_LIGHTS];
in vec3 toCameraVector;
// Spotlight
in vec3 toSpotlightVector;

// Fog
in vec3 worldPosition;
in vec4 viewSpace;
in vec4 lightSpace;

// Ouput data
out vec4 color;

uniform bool useClassic;

uniform sampler2DArray texture_array;
uniform sampler2D shadowMap;
uniform float ambientFactor;
uniform vec4 lightColour[MAX_TRACK_CONTRIB_LIGHTS];
uniform vec3 attenuation[MAX_TRACK_CONTRIB_LIGHTS];
uniform vec3 spotlightColour;
uniform vec3 spotlightDirection;
uniform float spotlightCutOff;
uniform float shineDamper;
uniform float reflectivity;

float ShadowCalculation(vec4 fragPosLightSpace)
{
    // perform perspective divide
    vec3 projCoords = lightSpace.xyz / lightSpace.w;
    // Depth map is in the range [0,1] and we also want to use projCoords to sample from the depth map so we transform the NDC coordinates to the range [0,1]
    projCoords = projCoords * 0.5 + 0.5;
    // The closest depth from the light's point of view
    float closestDepth = texture(shadowMap, projCoords.xy).r;
    // Projected vector's z coordinate equals the depth of the fragment from the light's perspective
    float currentDepth = projCoords.z;
    // Apply bias to remove acne, such that fragments are not incorrectly considered below the surface.
    float bias = 0.005;

    // Apply percentage closer filtering, to soften shadow edges (average neighbours by jittering projection coords)
    float shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
    for(int x = -1; x <= 1; ++x)
    {
        for(int y = -1; y <= 1; ++y)
        {
            // Check whether currentDepth is higher than closestDepth and if so, the fragment is in shadow
            float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;

    // Force the shadow value to 0.0 whenever the projected vector's z coordinate is larger than 1.0
    if(projCoords.z > 1.0) shadow = 0.0;

    return shadow;
}

void main(){
    vec4 tempColor = texture(texture_array, vec3(UV, texIndex)).rgba;

    if (tempColor.a <= 0.5)
       discard;

    // Attempt to remove NFS shader
    /*vec4 fogColor = vec4(80.0f/255.0f, 55.0f/255.0f, 0.0f, 1.0f);
    float dist = 0;
    float fogFactor = 0;
    // Compute distance used in fog equations
    dist = length(viewSpace);
    //linear fog
    // FogEnd - Distance/FogEnd - FogStart
    fogFactor = (80 - dist)/(80 - 1);
    fogFactor = clamp( fogFactor, 0.0, 1.0 );

    vec4 nfsColor = 0.7 *(tempColor + vec4(nfsDataOut.xyz, 1.0f));
    vec4 trackColor = mix(fogColor, nfsColor, fogFactor);*/

    // NFS PS2.0 Port
    vec4 v0 = nfsDataOut; // Something done to this? (Add diffuse and specular components)
    vec4 v1 = vec4(0.08f); // Fog factor (read from HRZ?)
    vec4 c5 = vec4(0.0f);
    vec4 c6 = vec4(1.0f);
    vec4 c7 = vec4(0.314f, 0.216f, 0.000f, 1.000f);
    vec4 r0 = vec4(0.0f, 0.0f, 0.0f, 0.0f); // Black mip sample (Possibly incorrect)
    vec4 r1 = tempColor;
    vec4 r10 = nfsDataOut;
    vec4 r2 = c5;
    vec4 r3 = r0;
    vec4 r4;
    r4.xyz = r3.xyz;
    r2 = c5;
    r3 = r0;
    r4.w = r3.w;
    r0 = r4;
    r2 = c5;
    r3 = r1;
    r4.xyz = r3.xyz;
    r2 = c5;
    r3 = r1;
    r4.w = r3.w;
    vec4 r5 = v0;
    vec4 r6 = r4;
    vec4 r7 = r5;
    vec4 r8 = r7 * r6;
    vec4 r9;
    r9.xyz = r8.xyz;
    r5 = v0;
    r6 = r4;
    r7 = r5;
    r8 = r7 * r6;
    r9.w = r8.w;
    r10 = mix(r9, c7, v1.w);
    r10.w = r9.w;
    vec4 nfsColor = r10;

    if(useClassic){
        color = nfsColor;
    } else {
        // Lay down summed diffuse and specular on top of NFS fragment colour
        vec3 unitNormal = normalize(surfaceNormal);
        vec3 unitVectorToCamera = normalize(toCameraVector);

        vec3 totalDiffuse = vec3(0.0f);
        vec3 totalSpecular = vec3(0.0f);

        for(int i = 0; i < MAX_TRACK_CONTRIB_LIGHTS; ++i){
           float distance = length(toLightVector[i]);
           float attenFactor = attenuation[i].x + (attenuation[i].y * distance) + (attenuation[i].z * distance * distance);
           vec3 unitLightVector = normalize(toLightVector[i]);
           // Diffuse
           float nDot1 = dot(unitNormal, unitLightVector);
           float brightness = max(nDot1, 0.0);
           vec3 lightDirection = -unitLightVector;
           vec3 reflectedLightDirection = reflect(lightDirection, unitNormal);
           // Specular
           float specularFactor = dot(reflectedLightDirection, unitVectorToCamera);
           specularFactor = max(specularFactor, 0.0);
           float dampedFactor = pow(specularFactor, shineDamper);
           totalDiffuse += (brightness * lightColour[i].xyz)/attenFactor;
           totalSpecular += (dampedFactor * reflectivity * lightColour[i].xyz)/attenFactor;
        }
        totalDiffuse = max(totalDiffuse, ambientFactor); // Min brightness

        float shadow = ShadowCalculation(lightSpace);
        vec3 ambient =  0.4f * nfsColor.rgb;
        vec3 lighting = (ambient + (1.0 - shadow) * (totalDiffuse + totalSpecular)) * nfsColor.rgb;
        color = vec4(lighting, 1.0);
        // DEBUG: Stop this debugData buffer from being optimised out
        if(debugDataOut == 32u){
            color.a += 0.01;
        }

        // Check if lighting is inside the spotlight cone
        float theta = dot(normalize(toSpotlightVector), normalize(-spotlightDirection));
        // Working with angles as cosines instead of degrees so a '>' is used.
        if(theta > spotlightCutOff) {
            //color.r += 0.2f;
            //color.g += 0.2f;
            //color.b += 0.2f;
        } else {

        }
    }
}