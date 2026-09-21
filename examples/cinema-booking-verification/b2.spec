Requirement: Cinema booking

Operation: create booking

Property: booking status has enum type BookingStatus with members CONFIRMED, CANCELLED.

Property: requested seats element identity is id.

If requested seats are not pairwise distinct, the operation must fail with com.example.cinema.BookingRejectedException.
