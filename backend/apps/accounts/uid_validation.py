"""
UID Validation Utilities for School-OS

Implements secure, verifiable unique identifiers for:
- SUID (Student Unique ID): S-SCHOOLCODE-YEAR-XXXXXX-C
- TUID (Teacher Unique ID): T-YEAR-XXXXXX-C

Where C is a Luhn checksum digit for validation.

Security Benefits:
1. Detects accidental transcription errors
2. Prevents simple ID forgery/modification  
3. Allows offline validation
4. Maintains readability with meaningful prefixes

Enhanced Security:
- HMAC-based integrity check (server-side)
- Luhn checksum (client-side validation)
"""

import hmac
import hashlib
import uuid
from datetime import datetime
from django.conf import settings


class LuhnValidator:
    """
    Implements the Luhn algorithm (mod 10) for checksum validation.
    Used by credit cards, IMEI numbers, etc.
    """
    
    @staticmethod
    def calculate_checksum(number_string):
        """
        Calculate Luhn checksum digit for a given string of digits.
        Returns a single digit (0-9) as string.
        """
        # Convert to list of integers, removing non-digits
        digits = [int(d) for d in number_string if d.isdigit()]
        
        # Reverse for processing
        digits = digits[::-1]
        
        # Double every second digit
        for i in range(1, len(digits), 2):
            digits[i] *= 2
            if digits[i] > 9:
                digits[i] -= 9
        
        # Sum all digits
        total = sum(digits)
        
        # Calculate check digit
        check_digit = (10 - (total % 10)) % 10
        return str(check_digit)
    
    @staticmethod
    def is_valid(number_string):
        """
        Validate a number string with Luhn checksum.
        The last digit should be the checksum.
        """
        # Extract digits only
        digits = ''.join(d for d in number_string if d.isdigit())
        
        if len(digits) < 2:
            return False
        
        # Split into number and check digit
        number_part = digits[:-1]
        check_digit = digits[-1]
        
        # Calculate expected checksum
        expected = LuhnValidator.calculate_checksum(number_part)
        
        return check_digit == expected


class UIDGenerator:
    """
    Generates and validates unique identifiers for School-OS entities.
    
    Format Examples:
    - SUID: S-DPS-2026-A3F9B2-7 (Student at DPS school, 2026, random, checksum)
    - TUID: T-2026-C7D8E9-3 (Teacher, 2026, random, checksum)
    
    The numeric portion is used for Luhn validation:
    - Year (4 digits) + Random hex converted to decimal (6+ digits) + Checksum
    """
    
    # Secret key for HMAC validation (server-side integrity)
    _SECRET_KEY = None
    
    @classmethod
    def _get_secret_key(cls):
        """Get or generate the secret key for HMAC."""
        if cls._SECRET_KEY is None:
            # Use Django's SECRET_KEY as base
            django_key = getattr(settings, 'SECRET_KEY', 'default-key-change-me')
            cls._SECRET_KEY = hashlib.sha256(f"uid-hmac-{django_key}".encode()).digest()
        return cls._SECRET_KEY
    
    @staticmethod
    def _hex_to_digits(hex_string, length=6):
        """Convert hex string to numeric digits."""
        # Convert hex to decimal, pad to desired length
        decimal_value = int(hex_string, 16)
        return str(decimal_value).zfill(length)[-length:]
    
    @classmethod
    def generate_suid(cls, school_code=None):
        """
        Generate a new Student UID with Luhn checksum.
        
        Format: S-{SCHOOL}-{YEAR}-{RANDOM6}-{CHECKSUM}
        Example: S-DPS-2026-847392-5
        """
        year = datetime.now().year
        random_hex = uuid.uuid4().hex[:6].upper()
        random_digits = cls._hex_to_digits(random_hex)
        
        # Build numeric portion for checksum: year + random_digits
        numeric_part = f"{year}{random_digits}"
        checksum = LuhnValidator.calculate_checksum(numeric_part)
        
        if school_code:
            suid = f"S-{school_code.upper()[:4]}-{year}-{random_hex}-{checksum}"
        else:
            suid = f"S-{year}-{random_hex}-{checksum}"
        
        return suid
    
    @classmethod
    def generate_tuid(cls):
        """
        Generate a new Teacher UID with Luhn checksum.
        
        Format: T-{YEAR}-{RANDOM6}-{CHECKSUM}
        Example: T-2026-C7D8E9-3
        """
        year = datetime.now().year
        random_hex = uuid.uuid4().hex[:6].upper()
        random_digits = cls._hex_to_digits(random_hex)
        
        # Build numeric portion for checksum: year + random_digits
        numeric_part = f"{year}{random_digits}"
        checksum = LuhnValidator.calculate_checksum(numeric_part)
        
        tuid = f"T-{year}-{random_hex}-{checksum}"
        return tuid
    
    @classmethod
    def validate_suid(cls, suid):
        """
        Validate a SUID format and checksum.
        
        Returns (is_valid, error_message)
        """
        if not suid:
            return False, "SUID is empty"
        
        parts = suid.split('-')
        
        # Check format: S-SCHOOL-YEAR-RANDOM-CHECKSUM or S-YEAR-RANDOM-CHECKSUM
        if len(parts) < 4 or len(parts) > 5:
            return False, "Invalid SUID format"
        
        if parts[0] != 'S':
            return False, "SUID must start with 'S'"
        
        # Extract year and random part based on format
        if len(parts) == 5:
            # Format: S-SCHOOL-YEAR-RANDOM-CHECKSUM
            school_code, year_str, random_hex, checksum = parts[1], parts[2], parts[3], parts[4]
        else:
            # Format: S-YEAR-RANDOM-CHECKSUM (legacy or no school)
            year_str, random_hex, checksum = parts[1], parts[2], parts[3]
        
        # Validate year
        try:
            year = int(year_str)
            if year < 2020 or year > 2100:
                return False, "Invalid year in SUID"
        except ValueError:
            return False, "Invalid year format in SUID"
        
        # Validate checksum
        random_digits = cls._hex_to_digits(random_hex)
        numeric_part = f"{year_str}{random_digits}"
        expected_checksum = LuhnValidator.calculate_checksum(numeric_part)
        
        if checksum != expected_checksum:
            return False, f"Invalid checksum. Expected {expected_checksum}, got {checksum}"
        
        return True, "Valid SUID"
    
    @classmethod
    def validate_tuid(cls, tuid):
        """
        Validate a TUID format and checksum.
        
        Returns (is_valid, error_message)
        """
        if not tuid:
            return False, "TUID is empty"
        
        parts = tuid.split('-')
        
        # Check format: T-YEAR-RANDOM-CHECKSUM
        if len(parts) != 4:
            return False, "Invalid TUID format"
        
        if parts[0] != 'T':
            return False, "TUID must start with 'T'"
        
        year_str, random_hex, checksum = parts[1], parts[2], parts[3]
        
        # Validate year
        try:
            year = int(year_str)
            if year < 2020 or year > 2100:
                return False, "Invalid year in TUID"
        except ValueError:
            return False, "Invalid year format in TUID"
        
        # Validate checksum
        random_digits = cls._hex_to_digits(random_hex)
        numeric_part = f"{year_str}{random_digits}"
        expected_checksum = LuhnValidator.calculate_checksum(numeric_part)
        
        if checksum != expected_checksum:
            return False, f"Invalid checksum. Expected {expected_checksum}, got {checksum}"
        
        return True, "Valid TUID"
    
    @classmethod
    def generate_hmac_signature(cls, uid):
        """
        Generate HMAC signature for a UID (server-side integrity check).
        This is stored separately and verified during sensitive operations.
        """
        key = cls._get_secret_key()
        signature = hmac.new(key, uid.encode(), hashlib.sha256).hexdigest()[:12]
        return signature
    
    @classmethod
    def verify_hmac_signature(cls, uid, signature):
        """Verify HMAC signature for a UID."""
        expected = cls.generate_hmac_signature(uid)
        return hmac.compare_digest(expected, signature)


def validate_uid(uid):
    """
    Universal UID validator - detects type and validates.
    
    Returns (is_valid, uid_type, error_message)
    """
    if not uid:
        return False, None, "UID is empty"
    
    if uid.startswith('S-'):
        is_valid, message = UIDGenerator.validate_suid(uid)
        return is_valid, 'SUID', message
    elif uid.startswith('T-'):
        is_valid, message = UIDGenerator.validate_tuid(uid)
        return is_valid, 'TUID', message
    else:
        return False, None, "Unknown UID format"


# Backward compatibility functions
def generate_suid(school_code=None):
    """Generate a new SUID with checksum."""
    return UIDGenerator.generate_suid(school_code)


def generate_tuid():
    """Generate a new TUID with checksum."""
    return UIDGenerator.generate_tuid()


def is_valid_suid(suid):
    """Check if SUID is valid."""
    is_valid, _ = UIDGenerator.validate_suid(suid)
    return is_valid


def is_valid_tuid(tuid):
    """Check if TUID is valid."""
    is_valid, _ = UIDGenerator.validate_tuid(tuid)
    return is_valid
