import { artForGame } from './game-art.js';

const FX_CLASSES = ['scene-fx-fire', 'scene-fx-neon', 'scene-fx-electric', 'scene-fx-crystal',
  'scene-fx-gold', 'scene-fx-jackpot', 'scene-fx-stars', 'scene-fx-ice', 'scene-fx-wave'];

/**
 * Apply lobby gallery art + FX as full-screen game backdrop.
 * @param {string} sceneRootId — element id of .game-scene container
 * @param {string} gameId — key in GAME_ART
 */
export function applyGameScene(sceneRootId, gameId) {
  const scene = document.getElementById(sceneRootId);
  if (!scene) return;

  const art = artForGame(gameId);
  const img = scene.querySelector('.game-scene-img');
  if (img && art.image) {
    img.src = art.image;
    img.alt = '';
  }

  FX_CLASSES.forEach((c) => scene.classList.remove(c));
  if (art.fx) scene.classList.add(`scene-fx-${art.fx}`);

  const screen = scene.closest('.screen');
  if (screen) screen.classList.add('has-gallery-scene');
}