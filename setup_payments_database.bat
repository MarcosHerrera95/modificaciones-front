@echo off
REM CHANGANET - Production Database Setup Script for Payments Module
REM Compatible with Windows environments without Docker
REM Run this script as Administrator if needed

echo ===========================================
echo CHANGANET Payments Database Setup
echo ===========================================
echo.

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: PostgreSQL client (psql) not found in PATH.
    echo Please install PostgreSQL and ensure psql is in your PATH.
    echo Download from: https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)

echo PostgreSQL client found.

REM Check if .env file exists
if not exist ".env" (
    echo WARNING: .env file not found.
    echo Please copy .env.example.payments to .env and configure your database connection.
    echo.
    echo DATABASE_URL should be in format:
    echo postgresql://username:password@host:port/database
    echo.
    pause
    exit /b 1
)

REM Extract DATABASE_URL from .env file
for /f "tokens=2 delims==" %%a in ('findstr "DATABASE_URL" .env') do set DATABASE_URL=%%a
set DATABASE_URL=%DATABASE_URL:"=%

if "%DATABASE_URL%"=="" (
    echo ERROR: DATABASE_URL not found in .env file.
    pause
    exit /b 1
)

echo Database URL found: %DATABASE_URL%

REM Extract database name from URL
for /f "tokens=4 delims=/" %%a in ("%DATABASE_URL%") do set DB_NAME=%%a
for /f "tokens=1 delims=?" %%a in ("%DB_NAME%") do set DB_NAME=%%a

if "%DB_NAME%"=="" (
    echo ERROR: Could not extract database name from DATABASE_URL.
    pause
    exit /b 1
)

echo Target database: %DB_NAME%

REM Check if SQL file exists
if not exist "create_payments_commissions_schema.sql" (
    echo ERROR: create_payments_commissions_schema.sql not found.
    echo Please ensure the SQL schema file is in the current directory.
    pause
    exit /b 1
)

echo SQL schema file found.

REM Ask for confirmation
echo.
echo This script will:
echo 1. Create the database if it doesn't exist
echo 2. Run the schema creation script
echo 3. Set up all tables, indexes, and constraints
echo.
set /p CONFIRM="Do you want to continue? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo Setup cancelled.
    pause
    exit /b 0
)

echo.
echo Starting database setup...

REM Create database if it doesn't exist
echo Creating database %DB_NAME% if it doesn't exist...
psql "%DATABASE_URL%" -c "SELECT 'Database exists'" 2>nul
if %errorlevel% neq 0 (
    REM Try to create database (this might fail if user doesn't have permissions)
    echo Attempting to create database...
    REM Extract connection details for database creation
    for /f "tokens=1,2,3 delims=:@/" %%a in ("%DATABASE_URL%") do (
        set PROTOCOL=%%a
        set USER=%%b
        set PASS=%%c
    )
    for /f "tokens=1,2 delims=:" %%a in ("%DATABASE_URL%") do set HOST_PORT=%%b
    for /f "tokens=1 delims=/" %%a in ("%HOST_PORT%") do set HOST=%%a
    for /f "tokens=2 delims=/" %%a in ("%HOST_PORT%") do set PORT_DB=%%a
    for /f "tokens=1 delims=:" %%a in ("%PORT_DB%") do set PORT=%%a
    for /f "tokens=2 delims=:" %%a in ("%PORT_DB%") do set DB=%%a

    REM Connect to postgres database to create the target database
    psql "postgresql://%USER%:%PASS%@%HOST%:%PORT%/postgres" -c "CREATE DATABASE %DB_NAME%;" 2>nul
    if %errorlevel% neq 0 (
        echo WARNING: Could not create database. It might already exist or you lack permissions.
        echo Continuing with schema setup...
    ) else (
        echo Database %DB_NAME% created successfully.
    )
)

REM Run the schema creation script
echo.
echo Running schema creation script...
psql "%DATABASE_URL%" -f "create_payments_commissions_schema.sql"

if %errorlevel% equ 0 (
    echo.
    echo ===========================================
    echo SUCCESS: Database setup completed!
    echo ===========================================
    echo.
    echo Next steps:
    echo 1. Verify your .env file has all required variables
    echo 2. Start your application
    echo 3. Test the payments functionality
    echo.
    echo For troubleshooting, check the PostgreSQL logs.
) else (
    echo.
    echo ERROR: Database setup failed.
    echo Please check the error messages above and ensure:
    echo - PostgreSQL is running
    echo - Database credentials are correct
    echo - You have sufficient permissions
    echo - The SQL file is valid
)

echo.
pause