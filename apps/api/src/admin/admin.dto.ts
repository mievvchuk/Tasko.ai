import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, ValidateIf } from 'class-validator';
import { PageDto } from '../projects/projects.dto.js';

export class UserQueryDto extends PageDto {
  @ApiPropertyOptional({ enum: ['CLIENT', 'FREELANCER', 'ADMIN'] })
  @IsOptional()
  @IsIn(['CLIENT', 'FREELANCER', 'ADMIN'])
  role?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'BLOCKED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'BLOCKED'])
  status?: string;
}
export class UpdateUserDto {
  @ApiPropertyOptional({ enum: ['CLIENT', 'FREELANCER', 'ADMIN'] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['CLIENT', 'FREELANCER', 'ADMIN'])
  role?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'BLOCKED'] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['ACTIVE', 'BLOCKED'])
  status?: string;
}

export class ReportExportQueryDto {
  @ApiPropertyOptional({
    enum: ['json', 'csv', 'xlsx', 'pdf'],
    default: 'json',
  })
  @IsIn(['json', 'csv', 'xlsx', 'pdf'])
  format: 'json' | 'csv' | 'xlsx' | 'pdf' = 'json';
}
