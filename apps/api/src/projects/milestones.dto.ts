import { PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateMilestoneDto {
  @IsString() @Length(2, 200) title!: string;
  @IsOptional() @IsString() @Length(0, 3000) description?: string;
  @IsInt() @Min(1) @Max(1000) position!: number;
  @IsOptional() @IsDateString() deadline?: string;
  @IsInt() @Min(0) @Max(10000000) amount!: number;
}

export class UpdateMilestoneDto extends PartialType(CreateMilestoneDto) {
  @IsOptional()
  @IsIn(['PLANNED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'])
  status?: string;
  @IsOptional()
  @IsIn(['UNPAID', 'RESERVED', 'PAID'])
  paymentStatus?: string;
}
