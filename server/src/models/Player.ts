import type { PlayerPublic } from "../types/room";

export class Player {
  public readonly id: string;
  public name: string;
  public socketId: string;
  public score: number;
  public isHost: boolean;
  public isConnected: boolean;
  public hasGuessedCorrectly: boolean;
  public lastActiveAt: number;

  constructor(params: {
    id: string;
    name: string;
    socketId: string;
    isHost?: boolean;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.socketId = params.socketId;
    this.score = 0;
    this.isHost = params.isHost ?? false;
    this.isConnected = true;
    this.hasGuessedCorrectly = false;
    this.lastActiveAt = Date.now();
  }

  public toPublic(): PlayerPublic {
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      isHost: this.isHost,
      isConnected: this.isConnected,
      hasGuessedCorrectly: this.hasGuessedCorrectly
    };
  }
}
