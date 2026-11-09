Ailand.games.othello = Ailand.games.othello || {};
// Shared core parts (core/event-bus.js and core/storage.js load before this file).
// Keys are stored as 'ailand:othello:<key>' (requirements 1.8).
Ailand.games.othello.bus = Ailand.core.EventBus.create();
Ailand.games.othello.store = Ailand.core.Storage.create('othello');
