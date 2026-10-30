import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
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
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}
export class UpdateTaskDto extends PartialType(CreateTaskDto, {
  skipNullProperties: false,
}) {}
export class TaskStatusDto {
  @ApiProperty({ enum: ['TODO', 'IN_PROGRESS'] })
  @IsIn(['TODO', 'IN_PROGRESS'])
  status: 'TODO' | 'IN_PROGRESS';
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Власна колонка канбану (лише для IN_PROGRESS)',
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
  @ApiPropertyOptional({ enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] })
  @IsOptional()
  @IsIn(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'])
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
}
export class OrderStatusDto {
  @ApiProperty({ enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  @IsIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status: string;
}
