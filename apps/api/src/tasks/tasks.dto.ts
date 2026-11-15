import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PageDto } from '../projects/projects.dto.js';

export class CreateTaskDto {
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 200)
  title: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 10000)
  description?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  priority?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 5, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  deadline?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Етап проєкту, до якого належить завдання; null — поза етапами',
  })
  @IsOptional()
  @IsUUID()
  milestoneId?: string | null;
}
export class UpdateTaskDto extends PartialType(CreateTaskDto, {
  skipNullProperties: false,
}) {}
export class TaskStatusDto {
  @ApiProperty({
    enum: ['TODO', 'IN_PROGRESS', 'REVISION', 'DONE'],
    description:
      'Новий етап картки. На перевірку (REVIEW) — через POST /tasks/:id/move з коментарем',
  })
  @IsIn(['TODO', 'IN_PROGRESS', 'REVISION', 'DONE'])
  status: 'TODO' | 'IN_PROGRESS' | 'REVISION' | 'DONE';
  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Причина повернення на доопрацювання',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 2000)
  reason?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Власна колонка канбану з тим самим статусом',
  })
  @IsOptional()
  @IsUUID()
  columnId?: string;
}
export class BoardColumnDto {
  @ApiProperty({ minLength: 2, maxLength: 40, example: 'Тестування' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 40)
  title: string;
  @ApiPropertyOptional({
    enum: ['TODO', 'IN_PROGRESS'],
    description: 'Етап колонки: «До виконання» (напр. Беклог) чи «У процесі»',
  })
  @IsOptional()
  @IsIn(['TODO', 'IN_PROGRESS'])
  status?: 'TODO' | 'IN_PROGRESS';
}
export class TaskQueryDto extends PageDto {
  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Пошук за назвою завдання',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(0, 200)
  search?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
  @ApiPropertyOptional({
    enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'REVISION', 'DONE'],
  })
  @IsOptional()
  @IsIn(['TODO', 'IN_PROGRESS', 'REVIEW', 'REVISION', 'DONE'])
  status?: string;
  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  priority?: string;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  overdue?: boolean;
  @ApiPropertyOptional({ format: 'uuid', description: 'Лише завдання етапу' })
  @IsOptional()
  @IsUUID()
  milestoneId?: string;
}

// Завдання з усіх доступних проєктів; projectId звужує до одного
export class AllTasksQueryDto extends TaskQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
export class OrderStatusDto {
  @ApiProperty({ enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  @IsIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status: string;
}

export class ColumnOrderDto {
  @ApiProperty({
    type: [String],
    description:
      "Порядок колонок до «На перевірці»: id власних колонок і 'TODO', 'IN_PROGRESS'",
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  order: string[];
}

export class RenameColumnDto {
  @ApiProperty({ minLength: 2, maxLength: 40, example: 'Frontend' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 40)
  title: string;
}

export class DeleteColumnQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Власна колонка того самого етапу, куди перенести картки; без нього — у стандартну',
  })
  @IsOptional()
  @IsUUID()
  moveTo?: string;
}
