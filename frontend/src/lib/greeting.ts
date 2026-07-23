export function getGreeting(name: string, title: string): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const prefix = title ? title + ' ' : '';
  return `Good ${timeOfDay}, ${prefix}${name}`;
}
