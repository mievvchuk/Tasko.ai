import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import {
  ChangePasswordDto,
  DisableTwoFactorDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TwoFactorCodeDto,
  VerifyEmailDto,
} from './auth.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { Actor } from './current-user.decorator.js';
import type { CurrentUser } from '../users/users.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { AuthEmailRateLimitGuard } from './email-rate-limit.guard.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(EmailVerificationService)
    private readonly verification: EmailVerificationService,
  ) {}

  @Post('register')
  @UseGuards(AuthEmailRateLimitGuard)
  @ApiOperation({ summary: 'Реєстрація клієнта або фрилансера' })
  @ApiBody({ type: RegisterDto })
  register(@Body() data: RegisterDto) {
    return this.auth.register(data);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Отримання JWT access token' })
  @ApiBody({ type: LoginDto })
  login(@Body() data: LoginDto, @Req() request: Request) {
    return this.auth.login(data, {
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
    });
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() data: ForgotPasswordDto) {
    return this.auth.forgotPassword(data.email);
  }

  @Post('verify-email')
  @UseGuards(AuthEmailRateLimitGuard)
  @HttpCode(200)
  verifyEmail(@Body() data: VerifyEmailDto) {
    return this.verification.verify(data.token);
  }

  @Post('resend-verification')
  @UseGuards(AuthEmailRateLimitGuard)
  @HttpCode(200)
  resendVerification(@Body() data: ForgotPasswordDto) {
    return this.auth.resendVerification(data.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() data: ResetPasswordDto) {
    return this.auth.resetPassword(data);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Поточний користувач' })
  me(@Actor() user: CurrentUser) {
    const { sessionId: _sessionId, ...publicUser } = user;
    return publicUser;
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  logout(@Actor() user: CurrentUser) {
    return this.auth.logout(user);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  sessions(@Actor() user: CurrentUser) {
    return this.auth.sessions(user);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  revokeSession(
    @Actor() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.auth.revokeSession(user, id);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  changePassword(@Actor() user: CurrentUser, @Body() data: ChangePasswordDto) {
    return this.auth.changePassword(user, data);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setupTwoFactor(@Actor() user: CurrentUser) {
    return this.auth.setupTwoFactor(user);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  enableTwoFactor(@Actor() user: CurrentUser, @Body() data: TwoFactorCodeDto) {
    return this.auth.enableTwoFactor(user, data);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  disableTwoFactor(
    @Actor() user: CurrentUser,
    @Body() data: DisableTwoFactorDto,
  ) {
    return this.auth.disableTwoFactor(user, data);
  }
}
