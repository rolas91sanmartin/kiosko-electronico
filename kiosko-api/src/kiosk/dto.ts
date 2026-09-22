import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BarcodeDto {
  @ApiProperty({ example: '0001' })
  @IsString()
  barcode!: string;
}
export class RegisterDto {
  @ApiProperty({ example: '0001' })
  @IsString() employeeCode!: string;

  @ApiProperty({ enum: [1, 2], description: '1 = entrada, 2 = salida' })
  @Type(() => Number) @IsInt() @IsIn([1, 2]) movement!: 1 | 2;
}
export class PayrollPageDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number) @IsInt() @Min(1) page = 1;
}
export class PhotoSaveDto {
  @ApiProperty() @IsString() token!: string;
  @ApiProperty({ example: 'data:image/jpeg;base64,...' }) @IsString() imageDataUrl!: string;
}
export class CodesDto {
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) codes!: string[];
}
export class EmailReceiptDto {
  @ApiProperty({ example: 'empleado@sanmartin.com' })
  @IsEmail() email!: string;

  @ApiProperty({ example: '01/09/2026' })
  @IsString() from!: string;

  @ApiProperty({ example: '15/09/2026' })
  @IsString() to!: string;
}
export class PayrollActionDto {
  @ApiProperty({ example: '01/09/2026' })
  @IsString() from!: string;

  @ApiProperty({ example: '15/09/2026' })
  @IsString() to!: string;
}
export class ReportFiltersDto {
  @ApiProperty({ example: '01/09/2026' })
  @IsString()
  from!: string;

  @ApiProperty({ example: '30/09/2026' })
  @IsString()
  to!: string;
  @ApiProperty({ type: [String] })
  @IsArray() @IsString({ each: true }) payrollCodes!: string[];
  @ApiProperty({ type: [String] })
  @IsArray() @IsString({ each: true }) dependencyCodes!: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true }) employeeCodes?: string[];
  @ApiPropertyOptional()
  @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean() includeExitTime?: boolean;
}
