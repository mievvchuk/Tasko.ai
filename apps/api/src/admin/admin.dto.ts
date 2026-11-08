import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { RegisterDto } from '../auth/auth.dto.js';
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
  @ApiPropertyOptional({ description: "Пошук за ім'ям або email" })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  search?: string;
}
// Роль адміністратора зміною ролі не видається — лише окремим акаунтом (CreateAdminDto)
export class UpdateUserDto {
  @ApiPropertyOptional({ enum: ['CLIENT', 'FREELANCER'] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['CLIENT', 'FREELANCER'])
  role?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'BLOCKED'] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['ACTIVE', 'BLOCKED'])
  status?: string;
}

// Новий окремий акаунт адміністратора; дію підтверджує паролем (і кодом 2FA, якщо увімкнено) той, хто створює
export class CreateAdminDto extends OmitType(RegisterDto, ['role'] as const) {
  @ApiProperty({ minLength: 8, maxLength: 128, format: 'password' })
  @IsString()
  @Length(8, 128)
  currentPassword: string;
}

export class ReportExportQueryDto {
  @ApiPropertyOptional({
    enum: ['json', 'csv', 'xlsx', 'pdf'],
    default: 'json',
  })
  @IsIn(['json', 'csv', 'xlsx', 'pdf'])
  format: 'json' | 'csv' | 'xlsx' | 'pdf' = 'json';
}

// Рішення модератора щодо нового проєкту; причина обов'язкова для відхилення
export class ModerationDecisionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';
  @ApiPropertyOptional({ description: 'Причина відхилення' })
  @ValidateIf((dto: ModerationDecisionDto) => dto.decision === 'REJECT')
  @IsString()
  @Length(5, 1000)
  reason?: string;
}
