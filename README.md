# 3D Underwater Aquarium Game

This is a procedural 3D underwater simulation and mini-game built with Vue 3, Vite, Three.js, and GSAP. It features a fully dynamic ecosystem with wandering fishes, procedural textures, interaction logic (feeding, shooting), and dynamic sound synthesis.

## Features

- **Procedural 3D Models and Textures**: Fish (various types like sharks, turtles, cows, etc.) and environments are generated procedently using Three.js geometries and HTML5 Canvas API without external asset dependencies.
- **Dynamic Fish AI**: 
  - **Wandering**: Fishes navigate the expanded 35x35 underwater boundary with long-distance target directions.
  - **Hunger & Feeding**: Fishes become hungry every 20 seconds. If food is within a 15-unit radius, they will swim towards it and eat it. Eating resets their hunger and makes them grow. After eating twice, they spawn two baby fishes.
  - **Starvation**: If a fish cannot find food for 50 seconds, it faints (flips belly up and sinks) for 30 seconds before recovering.
  - **Poisoning**: Eating a red mushroom with white spots causes the fish to die and disappear after 30 seconds.
  - **Fleeing**: Shooting a fish with a water gun startles it. It will actively avoid the player for the next 60 seconds if the player gets too close.
- **Player Interaction**:
  - **WASD + Shift**: Free camera movement in the underwater space.
  - **Spacebar**: Shoot a water bullet using the water gun to stun fishes or destroy mushrooms.
  - **J / K / L**: Spawn items directly in front of the player (J = Normal Mushroom, K = Poisonous Mushroom, L = Fish Food).
- **Web Audio API Sound Effects**: Native synthesized sound effects for splashing, popping, hitting, and unique hit sounds for different fish types (e.g., electric zap for jellyfish, deep thud for sharks, mooing for cows).

## Project Structure

The project has been modularized to maintain clean and readable code:

- `src/App.vue`: Main Vue component. Handles Three.js initialization, rendering loop, and UI overlays.
- `src/style.css`: All CSS styling for the game overlay, menus, and UI.
- `src/utils/animate.js`: Contains the core game loop logic (`animateGame`). Handles frame-by-frame updates for fish AI, collision detection, movement, and physics.
- `src/utils/models.js`: Handles the procedural generation of fish textures (`generateFishTexture`) and the assembly of 3D meshes for different fish types (`createFishModel`).
- `src/utils/fishes.js`: Logic for spawning the initial batch of fishes and handling the reproduction of baby fishes.
- `src/utils/mushroom.js`: Logic for spawning normal and poisonous mushrooms, including their growth animations.
- `src/utils/interactions.js`: Handles player-initiated actions like shooting water bullets, dropping food, creating the water gun model, and spawning bubbles.
- `src/utils/environment.js`: Sets up the static 3D environment including the tank, table, water volume, rocks, and swaying seaweeds.
- `src/utils/audio.js`: Contains the `playSound` function which uses the Web Audio API to synthesize various sound effects.

## Controls

| Key / Mouse | Action |
| --- | --- |
| **W, A, S, D** | Move camera Forward, Left, Backward, Right |
| **Shift** | Move camera Downwards |
| **Mouse Drag** | Look around (OrbitControls) |
| **Spacebar** | Shoot Water Bullet (aim with crosshair) |
| **J** | Spawn a Normal Mushroom in front of you |
| **K** | Spawn a Poisonous Mushroom in front of you |
| **L** | Drop a piece of Fish Food in front of you |

## How to Run

1. Make sure you have Node.js installed.
2. Run `npm install` to install dependencies (Vue, Three.js, GSAP).
3. Run `npm run dev` to start the Vite development server.
4. Open the provided localhost URL in your browser.

## Future Iteration Ideas

- **Advanced Ecosystem**: Introduce predators (sharks) that actively hunt smaller fishes when hungry.
- **Lighting & Shadows**: Enhance the underwater lighting with caustics or dynamic sun rays piercing through the water surface.
- **UI Enhancements**: Add a health/hunger bar above fishes when hovered, or a player score based on how large the fish population grows.
- **More Entities**: Add crabs, squids, or collectible treasures to the sea floor.