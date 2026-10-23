import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateComplaintDto {
  @IsOptional() @IsUUID() targetUserId?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsString() @Length(3, 120) reason!: string;
  @IsString() @Length(10, 3000) description!: string;
}

export class DecideComplaintDto {
  @IsIn(['RESOLVED', 'REJECTED']) status!: 'RESOLVED' | 'REJECTED';
  @IsString() @Length(3, 2000) adminNote!: string;
}
