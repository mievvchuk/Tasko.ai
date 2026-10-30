import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// Одна попередня репліка розмови — щоб агент розумів уточнення на кшталт «а що з другим?»
export class ChatTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString()
  @Length(1, 4000)
  content: string;
}

// Текст прикріпленого матеріалу, який раніше повернув POST /agent/attachments
export class ChatAttachmentDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiProperty({ minLength: 1, maxLength: 10000 })
  @IsString()
  @Length(1, 10000)
  text: string;
}

export class ChatDto {
  @ApiPropertyOptional({
    type: [ChatAttachmentDto],
    maxItems: 3,
    description: 'Матеріали, прикріплені до цього запитання',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ChatAttachmentDto)
  attachments?: ChatAttachmentDto[];

  @ApiPropertyOptional({
    type: [ChatTurnDto],
    maxItems: 12,
    description: 'Попередні репліки розмови, від старих до нових',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];

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
