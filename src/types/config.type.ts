import { ConfigMetadata } from "../meta/config.meta";

export interface ConfigCategories {
  linting: string[];
  testing: string[];
  building: string[];
  git: string[];
  editor: string[];
  other: string[];
}

export interface DetectedConfig {
  name: string;
  detectedFiles: string[];
  version?: string;
}

export interface ConfigPattern {
  name: string;
  files?: string[];
  directories?: string[];
}

export interface DetailedConfigInfo {
  all: DetectedConfig[];
  categorized: ConfigCategories;
  details: Array<DetectedConfig & { metadata?: ConfigMetadata }>;
}
