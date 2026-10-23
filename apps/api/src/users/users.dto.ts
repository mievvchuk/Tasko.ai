import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdateFreelancerProfileDto {
  @ApiPropertyOptional({ maxLength: 3000 })
  @IsOptional()
  @IsString()
  @Length(0, 3000)
  bio?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000000)
  hourlyRate?: number;

  @ApiProperty({ enum: ['AVAILABLE', 'BUSY', 'UNAVAILABLE'] })
  @IsIn(['AVAILABLE', 'BUSY', 'UNAVAILABLE'])
  availability!: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  skills!: string[];
}

export class CreatePortfolioItemDto {
  @IsString()
  @Length(2, 120)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Length(1, 1000)
  url!: string;
}

export class UpdatePortfolioItemDto extends PartialType(
  CreatePortfolioItemDto,
) {}
