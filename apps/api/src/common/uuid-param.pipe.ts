import { NotFoundException, type PipeTransform } from "@nestjs/common";
import { z } from "zod";

const uuid = z.uuid();

/** Malformed ids are reported as not found, like ids from other businesses. */
export class UuidParamPipe implements PipeTransform<string, string> {
  constructor(private readonly resource: string) {}

  transform(value: string): string {
    if (!uuid.safeParse(value).success) throw new NotFoundException(`${this.resource} not found`);
    return value;
  }
}
