export enum AnalysisMode {
  LIGHT = 'LIGHT',
  MEDIUM = 'MEDIUM',
  HEAVY = 'HEAVY',
  ADVERSARIAL = 'ADVERSARIAL'
}

export interface Message {
  role: 'user' | 'model';
  content: string;
  id: string;
  isThinking?: boolean;
  mode?: AnalysisMode;
  timestamp: number;
}

export interface GenerationConfig {
  mode: AnalysisMode;
  apiKey: string;
}
