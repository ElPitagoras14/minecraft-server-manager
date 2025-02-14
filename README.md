# Minecraft Server Manager

> [!Warning]
> This project is still in development and is not ready for production use.

## Description

This is a Minecraft Server Manager that allows you to manage your Minecraft servers using docker containers for each server and a queue to start or stop servers. The server image documentation can be found [here](https://github.com/itzg/docker-minecraft-server).

It consists of three core components:

- **Server Manager API** - A backend service built with Node.js and Express that provides a REST API for managing Minecraft servers through docker integration.
- **Server Manager Web** - A frontend application built with Next.js that provides a user interface for managing Minecraft servers and users.
- **Server Manager Discord Bot** - A Discord bot built with Discord.js that provides a Discord integration for simple managing Minecraft servers.

## Getting Started

> [!Important]
> Rename .env.example to .env and fill it. Rename docker-compose.yaml.example to docker-compose.yaml and change according your needs. Ensure that you fill environment variables on .env and docker-compose.yaml files at the root of the project.

### Docker Use

1. Clone this repository:

    ```bash
    git clone https://github.com/ElPitagoras14/anime-scraper.git
    cd anime-scraper
    ```

2. Build the images with the following command at the root of project:

    ```bash
    docker-compose up -d
    ```

## Ports Used
|Service|Port Used|
|-------|---------|
|Web|`4010`|
|Api|`4012`|
|MySQL|`4013`|
|Redis|`4014`|

## Roadmap
- [x] Simple server management
- [x] Docker container server integration
- [x] Queue system
- [x] Discord bot integration
- [x] Simple Server configuration
- [x] Server logs
- [x] Server backup
- [x] Server restore
- [ ] User agnostic provider
- [ ] Centralized backup management
- [ ] Mods integration
- [ ] Rcon cli integration
- [ ] Realtime status integration
- [ ] Advanced server configuration
- [ ] Add License
- [ ] Better documentation

## Author

- [Jonathan García](https://github.com/ElPitagoras14) - Computer Science Engineer