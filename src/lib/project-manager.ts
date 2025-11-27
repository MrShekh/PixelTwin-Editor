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

export const saveProject = (project: Project): void => {
    if (typeof window === 'undefined') return;
    const projects = getAllProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
        projects[index] = project;
    } else {
        projects.push(project);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const getProject = (id: string): Project | null => {
    if (typeof window === 'undefined') return null;
    const projects = getAllProjects();
    return projects.find(p => p.id === id) || null;
};

export const getAllProjects = (): Project[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const deleteProject = (id: string): void => {
    if (typeof window === 'undefined') return;
    const projects = getAllProjects().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const createProject = (data: Partial<Project>): Project => {
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
    saveProject(newProject);
    return newProject;
};
