import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ChatDto {
  @ApiProperty({
    example: 'Які завдання потребують моєї уваги?',
    minLength: 1,
    maxLength: 2000,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 2000)
  message: string;
}

export class GeneratePlanDto {
  @ApiPropertyOptional({
    maxLength: 3000,
    description: 'Побажання власника до чернетки плану',
  })
  @IsOptional()
  @IsString()
  @Length(0, 3000)
  instructions?: string;
}

export class ApplyPlanDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Стабільний UUID для безпечного повторення підтвердження',
  })
  @IsUUID()
  requestId: string;

  @ApiProperty({
    type: Object,
    description:
      'Відредагований план: milestones із title, description, acceptanceCriteria, tasks. Завдання додатково мають priority LOW/MEDIUM/HIGH.',
  })
  @IsObject()
  plan: Record<string, unknown>;
}
