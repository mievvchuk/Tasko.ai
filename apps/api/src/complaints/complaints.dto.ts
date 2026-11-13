import {
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

// Що сталося: від категорії залежить рекомендована санкція (див. довідку «Правила платформи»)
export const complaintCategories = [
  'NON_PAYMENT',
  'FRAUD',
  'NOT_DELIVERED',
  'POOR_QUALITY',
  'ABUSE',
  'OFF_PLATFORM',
  'OTHER',
] as const;
export const complaintActions = [
  'NONE',
  'WARNING',
  'RESTRICT',
  'BLOCK',
] as const;

export class CreateComplaintDto {
  @IsOptional() @IsUUID() targetUserId?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsIn(complaintCategories) category?: string;
  @IsString() @Length(3, 120) reason!: string;
  @IsString() @Length(10, 3000) description!: string;
}

export class DecideComplaintDto {
  @IsIn(['RESOLVED', 'REJECTED']) status!: 'RESOLVED' | 'REJECTED';
  @IsString() @Length(3, 2000) adminNote!: string;
  // Санкція до користувача, на якого скаржаться; лише для RESOLVED
  @IsOptional()
  @IsIn(complaintActions)
  action?: (typeof complaintActions)[number];
  @ValidateIf((data: DecideComplaintDto) => data.action === 'RESTRICT')
  @IsInt({ message: 'Вкажіть строк обмеження в днях.' })
  @Min(1)
  @Max(90)
  restrictDays?: number;
}
