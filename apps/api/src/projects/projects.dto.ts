import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
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
import { Type, Transform } from 'class-transformer';

export const projectStatuses = [
  'PLANNING',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
] as const;

export class PageDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class ProjectQueryDto extends PageDto {
  @ApiPropertyOptional({ enum: projectStatuses })
  @IsOptional()
  @IsIn(projectStatuses)
  status?: (typeof projectStatuses)[number];
}

export class MarketplaceQueryDto extends PageDto {
  @IsOptional() @IsString() @Length(1, 200) search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() skillId?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  minBudget?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  maxBudget?: number;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  favoritesOnly?: boolean;
}

export class CreateProjectDto {
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 200)
  title: string;

  @ApiPropertyOptional({ maxLength: 10000 })
  @IsOptional()
  @IsString()
  @Length(0, 10000)
  description?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Новий дедлайн має бути пізніше поточного часу.',
  })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  budgetMin?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  budgetMax?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('4', { each: true })
  skillIds?: string[];
}

export class UpdateProjectDto extends PartialType(CreateProjectDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional({ enum: projectStatuses })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(projectStatuses)
  status?: (typeof projectStatuses)[number];
}

export class AddMemberDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId: string;
}

export class CreateApplicationDto {
  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 2000)
  message: string;

  @ApiProperty({ minimum: 1, maximum: 10000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000000)
  proposedBudget: number;

  @ApiProperty({ minimum: 1, maximum: 365 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  proposedDays: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  portfolioItemId?: string;
}

export class CreateFreelancerReviewDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  freelancerId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(0, 2000)
  comment?: string;
}
