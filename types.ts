
export enum Severity {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High'
}

export enum ComplianceStatus {
  PASS = 'Pass',
  WARNING = 'Warning',
  FAIL = 'Fail'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Finding {
  category: string;
  issue: string;
  severity: Severity;
  recommendation: string;
  guidelineReference: string;
}

export interface AnalysisReport {
  overallStatus: ComplianceStatus;
  riskScore: number; // 0 to 100
  summary: string;
  findings: Finding[];
  isEligibleForFYP: boolean;
  sources?: GroundingSource[];
  type?: 'video' | 'image';
}

export interface VideoFile {
  file: File;
  preview: string;
}

export interface ImageFile {
  file: File;
  preview: string;
  base64: string;
}

export type AppTab = 'video' | 'image' | 'editor' | 'voice' | 'video-gen';
