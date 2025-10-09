// Helper function to calculate completion percentages - safe for client-side usage
export const calculateCompletion = (items: { completed: boolean }[] | { silos: { tasks: { completed: boolean }[] }[] } | { projects: { silos: { tasks: { completed: boolean }[] }[] }[] }) => {
  let tasks: { completed: boolean }[] = [];

  if (Array.isArray(items) && (items.length === 0 || 'completed' in items[0])) {
    tasks = items as { completed: boolean }[];
  } else if (typeof items === 'object' && items !== null && 'silos' in items && Array.isArray((items as any).silos)) {
    const project = items as { silos: { tasks: { completed: boolean }[] }[] };
    tasks = project.silos.flatMap(silo => silo.tasks);
  } else if (typeof items === 'object' && items !== null && 'projects' in items && Array.isArray((items as any).projects)) {
    const company = items as { projects: { silos: { tasks: { completed: boolean }[] }[] }[] };
    tasks = company.projects.flatMap(project => project.silos.flatMap(silo => silo.tasks));
  }


  if (tasks.length === 0) return 0;
  const completedTasks = tasks.filter(task => task.completed).length;
  return Math.round((completedTasks / tasks.length) * 100);
};
