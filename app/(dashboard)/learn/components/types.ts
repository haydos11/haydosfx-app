export type VideoLevel = "Beginner" | "Intermediate" | "Advanced";

export type CuratedVideo = {
  id: string;
  title: string;
  description?: string;
  level?: VideoLevel;
  duration?: string;
  tags?: string[];
};