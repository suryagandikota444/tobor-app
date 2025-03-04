def calculate_gears(gear_ratio, R):
    Np = 3  # Number of planet gears
    
    # Calculate Sun Gear teeth (S)
    S = R / ((1 / gear_ratio) - 1)
    
    # Ensure S is an integer
    if not S.is_integer():
        return "No valid solution with given parameters."
    
    S = int(S)
    # print(S)
    # Calculate Planet Gear teeth (P)
    P = (R - S) / 2

    # Ensure P is an integer
    if not P.is_integer():
        return "No valid solution with given parameters."

    P = int(P)

    # Check if (R + S) / Np is a whole number
    if (R + S) % Np != 0:
        return "No valid solution as (R + S) / Np is not a whole number.: {}".format((R + S) % Np)
    
    return {"S": S, "P": P}

# Example usage:
gear_ratio = 1/9  # Example gear ratio 1:6
R = 80  # Example R value

result = calculate_gears(gear_ratio, R)
print(result)