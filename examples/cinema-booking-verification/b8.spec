Requirement: Cinema booking

Operation: create booking

Property: booking status has enum type BookingStatus with members CONFIRMED, CANCELLED.

Property: requested seats element identity is id.

If seat hall name is not the showtime hall name, the operation must fail with com.example.cinema.BookingRejectedException.

When the operation succeeds,
booking status becomes CONFIRMED.
