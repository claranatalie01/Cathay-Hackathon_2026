// The planner marks research with source tags like "[S903]". They are for the sources list, not for
// people reading a stop's description, so remove them from visible text.
export const withoutSourceTags = (text) => (typeof text === 'string' ? text.replace(/\s*\[S\d+\]/g, '').trim() : text);
