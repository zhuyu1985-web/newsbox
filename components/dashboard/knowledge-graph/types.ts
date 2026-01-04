export type EntityType =
  | "PERSON"
  | "ORG"
  | "GPE"
  | "EVENT"
  | "TECH"
  | "WORK_OF_ART"
  | "DEFAULT";

export type GraphNode = {
  id: string;
  name: string;
  type: EntityType;
  val: number;
  color?: string;
  x?: number;
  y?: number;
};

export type GraphLink = {
  id: string;
  source: string | any;
  target: string | any;
  label: string;
  rawRelation?: string;
  evidenceSnippet?: string | null;
  sourceNoteId?: string | null;
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export type SelectedLink = GraphLink | null;
