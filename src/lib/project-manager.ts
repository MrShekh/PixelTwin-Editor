import { get, set } from 'idb-keyval';

export interface Project {
    id: string;
    name: string;
    originalUrl?: string;
    html: string;
    css: string[];
    assets: any[];
    createdAt: number;
    updatedAt: number;
}

const STORAGE_KEY = 'pixeltwin_projects';

export const getAllProjects = async (): Promise<Project[]> => {
    if (typeof window === 'undefined') return [];
    try {
        const projects = await get<Project[]>(STORAGE_KEY);
        return projects || [];
    } catch (error) {
        console.error('Failed to get projects:', error);
        return [];
    }
};

export const saveProject = async (project: Project): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
        const projects = await getAllProjects();
        const index = projects.findIndex(p => p.id === project.id);
        if (index >= 0) {
            projects[index] = project;
        } else {
            projects.push(project);
        }
        await set(STORAGE_KEY, projects);
    } catch (error) {
        console.error('Failed to save project:', error);
        throw error;
    }
};

export const getProject = async (id: string): Promise<Project | null> => {
    if (typeof window === 'undefined') return null;
    const projects = await getAllProjects();
    return projects.find(p => p.id === id) || null;
};

export const deleteProject = async (id: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    const projects = await getAllProjects();
    const newProjects = projects.filter(p => p.id !== id);
    await set(STORAGE_KEY, newProjects);
};

export const createProject = async (data: Partial<Project>): Promise<Project> => {
    const newProject: Project = {
        id: crypto.randomUUID(),
        name: data.name || 'Untitled Project',
        originalUrl: data.originalUrl,
        html: data.html || '',
        css: data.css || [],
        assets: data.assets || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    await saveProject(newProject);
    return newProject;
};
