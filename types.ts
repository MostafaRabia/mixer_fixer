export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface AudioVisualizerProps {
  isPlaying: boolean;
}

export interface InstructionState {
  action: string;
  message: string;
}
