#pragma once

#include "../Util/ImageLoader.h"
#include "../Loaders/TrackLoader.h"
#include "../Shaders/SkydomeShader.h"
#include "../Scene/Camera.h"


class SkyRenderer {
public:
    explicit SkyRenderer(const std::shared_ptr<ONFSTrack> &activeTrack);
    ~SkyRenderer();
    void renderSky(const Camera &mainCamera, const Light &sun, const ParamData &userParams, float elapsedTime);
    // Create and compile our GLSL programs from the shaders
    SkydomeShader skydomeShader;
private:
    std::shared_ptr<ONFSTrack> track;

    // Sphere model for skydome
    CarModel skydome;

    GLuint clouds1TextureID = 0, clouds2TextureID = 0, sunTextureID = 0, moonTextureID = 0, tintTextureID = 0, tint2TextureID = 0;

    // Load cloud, sun, moon and tint textures
    void loadTextures();
};