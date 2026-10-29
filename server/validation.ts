import { BadRequestException } from "@nestjs/common";
export function text(
  value: unknown,
  field: string,
  min = 1,
  max = 500,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new BadRequestException(
      `Поле «${field}»: от ${min} до ${max} символов`,
    );
  return value.trim();
}
export function id(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1)
    throw new BadRequestException("Некорректный ID");
  return n;
}
export function count(value: unknown, fallback = 1, max = 10000): number {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max)
    throw new BadRequestException("Некорректное количество");
  return n;
}
export function dates(start: unknown, end: unknown) {
  const a = new Date(String(start)),
    b = new Date(String(end));
  if (
    !Number.isFinite(+a) ||
    !Number.isFinite(+b) ||
    b <= a ||
    a < new Date(new Date().setHours(0, 0, 0, 0))
  )
    throw new BadRequestException("Выберите корректный будущий период аренды");
  return [a, b];
}
export function page(q: any) {
  return [count(q.limit, 20, 100), count(q.offset, 0, 100000)];
}
export const publicUser = (u: any) =>
  u
    ? {
        id: u.id,
        email: u.email,
        name: u.name,
        contactPhone: u.contactPhone,
        role: u.role,
      }
    : null;
