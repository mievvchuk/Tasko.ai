import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class MessageDto {
  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 5000)
  content: string;
}
export class SubmissionDto {
  @ApiProperty({ minLength: 1, maxLength: 10000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 10000)
  description: string;
  @ApiPropertyOptional({ type: [String], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  fileIds?: string[];
}
export class ReviewDto {
  @ApiProperty({ enum: ['APPROVE', 'NEEDS_REVISION'] })
  @IsIn(['APPROVE', 'NEEDS_REVISION'])
  decision: 'APPROVE' | 'NEEDS_REVISION';
  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 5000)
  feedback: string;
}

// Переміщення картки на Kanban-дошці (POST /tasks/:id/move)
export class MoveTaskDto {
  @ApiProperty({ enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'REVISION', 'DONE'] })
  @IsIn(['TODO', 'IN_PROGRESS', 'REVIEW', 'REVISION', 'DONE'])
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'REVISION' | 'DONE';
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Власна колонка етапу «До виконання» чи «У роботі»',
  })
  @IsOptional()
  @IsUUID()
  columnId?: string;
  @ApiPropertyOptional({
    maxLength: 10000,
    description: 'Опис результату чи посилання — обов’язково для REVIEW',
  })
  @IsOptional()
  @IsString()
  @Length(0, 10000)
  comment?: string;
  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Причина — обов’язково для повернення на доопрацювання',
  })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  reason?: string;
  @ApiPropertyOptional({ type: [String], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  fileIds?: string[];
}
