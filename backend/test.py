def main():

    n = int(input())

    current = 1
    row = 1

    while current <= n:
        for _ in range(row):
            print(current,end=' ')
            current += 1
            if current > n:
                break
        print()
        row += 1

if __name__ == "__main__":
    main()