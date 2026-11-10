import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Ім'я без емодзі: піктограми, прапорці (regional indicators) і їхні «склеювачі»
export const nameWithoutEmoji =
  /^[^\p{Extended_Pictographic}\p{Regional_Indicator}‍️⃣]*$/u;
export const nameWithoutEmojiMessage = 'Ім’я не може містити емодзі.';

export class LoginDto {
  @ApiProperty({ example: 'client@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 128, format: 'password' })
  @IsString()
  @Length(8, 128)
  password: string;

  @ApiProperty({ required: false, example: '123456' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  twoFactorCode?: string;

  @ApiProperty({
    required: false,
    description: 'Довгий сеанс (30 днів) замість 1 години',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: 8, maxLength: 128, format: 'password' })
  @IsString()
  @Length(8, 128)
  currentPassword: string;

  @ApiProperty({ minLength: 8, maxLength: 128, format: 'password' })
  @IsString()
  @Length(8, 128)
  newPassword: string;
}

export class TwoFactorCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class DisableTwoFactorDto extends TwoFactorCodeDto {
  @ApiProperty({ minLength: 8, maxLength: 128, format: 'password' })
  @IsString()
  @Length(8, 128)
  password: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ example: 'Іван', minLength: 2, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  @Matches(/\S/)
  @Matches(nameWithoutEmoji, { message: nameWithoutEmojiMessage })
  name: string;

  @ApiProperty({ enum: ['CLIENT', 'FREELANCER'] })
  @IsIn(['CLIENT', 'FREELANCER'])
  role: 'CLIENT' | 'FREELANCER';
}
