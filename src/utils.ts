export const isNumber = (obj: unknown): obj is number => !isNaN(obj as number);
export const isString = (obj: unknown): obj is string => typeof obj === 'string';
export const isBoolean = (obj: unknown): obj is boolean => typeof obj === 'boolean';

export const nonNullable = <T>(value: T): value is NonNullable<T> => value !== null && value !== undefined;
