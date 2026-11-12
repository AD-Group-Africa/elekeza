import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface Objective {
  id: number;
  code: string;
  statement: string;
}
export interface Competency {
  id: number;
  code: string;
  name: string;
  objectives: Objective[];
}
export interface SubStrand {
  id: number;
  code: string;
  name: string;
  competencies: Competency[];
}
export interface Strand {
  id: number;
  code: string;
  name: string;
  subStrands: SubStrand[];
}
export interface LearningArea {
  id: number;
  code: string;
  name: string;
  shared: boolean;
  strands: Strand[];
}

/** One competency's evidence (learner or class level). */
export interface CompetencyProgress {
  competencyId: number;
  competency: string;
  strand: string;
  learningArea: string;
  lessonsMapped?: number;
  learnersAssessed?: number;
  attempts: number;
  averageScore: number;
}

export type NodeLevel = 'area' | 'strand' | 'subStrand' | 'competency' | 'objective';

/** Where to POST a new child of each level (parent id in the URL). */
const CREATE_PATH: Record<NodeLevel, (parentId?: number) => string> = {
  area: () => '/curriculum/areas',
  strand: (areaId) => `/curriculum/areas/${areaId}/strands`,
  subStrand: (strandId) => `/curriculum/strands/${strandId}/sub-strands`,
  competency: (subStrandId) => `/curriculum/sub-strands/${subStrandId}/competencies`,
  objective: (competencyId) => `/curriculum/competencies/${competencyId}/objectives`,
};

export const curriculumApi = {
  tree: () => apiClient.get<{ areas: LearningArea[] }>('/curriculum/tree').then((r) => r.data.areas ?? []),
  /** Areas, strands, sub-strands and competencies take a name; objectives take a statement. */
  create: (level: NodeLevel, parentId: number | undefined, code: string, text: string) =>
    apiClient.post(
      CREATE_PATH[level](parentId),
      level === 'objective' ? { code, statement: text } : { code, name: text },
    ),
  mapLesson: (contentId: number, objectiveId: number | null) =>
    apiClient.put(`/curriculum/content/${contentId}/objective`, { objectiveId }),
  learnerProgress: (learnerId: number) =>
    apiClient
      .get<{ competencies: CompetencyProgress[]; note?: string }>(
        `/curriculum/learners/${learnerId}/competency-progress`,
      )
      .then((r) => r.data),
  classSummary: (classId: number) =>
    apiClient
      .get<{ competencies: CompetencyProgress[] }>(`/curriculum/classes/${classId}/competency-summary`)
      .then((r) => r.data),
};

export const curriculumKeys = {
  tree: ['curriculum', 'tree'] as const,
  learner: (learnerId: number) => ['curriculum', 'learner', learnerId] as const,
  class: (classId: number) => ['curriculum', 'class', classId] as const,
};

export const useCurriculumTree = () => useQuery({ queryKey: curriculumKeys.tree, queryFn: curriculumApi.tree });

/** Flattens the tree into selectable objectives labelled with their path. */
export function flattenObjectives(areas: LearningArea[]) {
  return areas.flatMap((a) =>
    a.strands.flatMap((s) =>
      s.subStrands.flatMap((ss) =>
        ss.competencies.flatMap((c) =>
          c.objectives.map((o) => ({ id: o.id, label: `${a.name} › ${s.name} › ${c.name}: ${o.statement}` })),
        ),
      ),
    ),
  );
}
