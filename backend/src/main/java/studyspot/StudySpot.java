package studyspot;

import java.util.List;
import java.util.Set;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@SpringBootApplication
@RestController
@RequestMapping("/api/spots")
public class StudySpot {
    private static final Set<String> ZONES = Set.of("lib", "cafe", "a", "b");
    private static final Set<String> TYPES = Set.of("Library Corner", "Cafe", "Classroom");
    private static final Set<String> ISSUES = Set.of(
        "Broken outlet", "No / slow Wi-Fi", "Too noisy", "Dirty", "Overcrowded", "Other");
    private final JdbcClient db;

    public StudySpot(JdbcClient db) {
        this.db = db;
    }

    public static void main(String[] args) {
        SpringApplication.run(StudySpot.class, args);
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public String list() {
        return db.sql("""
            select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object(
              'ratings', coalesce((select jsonb_agg(jsonb_build_object(
                  'scores', r.scores, 'review', r.review, 'createdAt', r.created_at
                ) order by r.id desc) from studyspot.ratings r where r.spot_id = s.id), '[]'::jsonb),
              'reports', coalesce((select jsonb_agg(jsonb_build_object(
                  'category', p.category, 'details', p.details, 'status', p.status
                ) order by p.id desc) from studyspot.reports p where p.spot_id = s.id), '[]'::jsonb)
              ) order by s.id), '[]'::jsonb)::text
            from studyspot.spots s
            """).query(String.class).single();
    }

    record SpotInput(String name, String zone, String type, Integer opens, Integer closes, Double x, Double y, Double latitude, Double longitude) {}
    record LocationInput(Double latitude, Double longitude) {}
    record RatingInput(List<Integer> scores, String review) {}
    record ReportInput(String category, String details) {}
    record Created(long id) {}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Created add(@RequestBody SpotInput input) {
        String name = clean(input.name(), 100, true);
        require(input.zone() != null && ZONES.contains(input.zone()), "Choose a campus area.");
        require(input.type() != null && TYPES.contains(input.type()), "Choose a spot type.");
        require(input.opens() != null && input.closes() != null && input.opens() >= 0
            && input.closes() <= 24 && input.opens() < input.closes(), "Closing time must be after opening time.");
        boolean validPin = input.x() == null && input.y() == null
            || input.x() != null && input.y() != null
            && input.x() >= 0 && input.x() <= 360 && input.y() >= 0 && input.y() <= 440;
        require(validPin, "Choose a pin within the campus map.");
        validateLocation(input.latitude(), input.longitude());
        long id = db.sql("""
            insert into studyspot.spots (name, zone, type, opens, closes, x, y, latitude, longitude)
            values (:name, :zone, :type, :opens, :closes, :x, :y, :latitude, :longitude) returning id
            """).param("name", name).param("zone", input.zone()).param("type", input.type())
            .param("opens", input.opens()).param("closes", input.closes())
            .param("x", input.x(), java.sql.Types.DOUBLE).param("y", input.y(), java.sql.Types.DOUBLE)
            .param("latitude", input.latitude(), java.sql.Types.DOUBLE)
            .param("longitude", input.longitude(), java.sql.Types.DOUBLE)
            .query(Long.class).single();
        return new Created(id);
    }

    @PutMapping("/{id}/location")
    public Created locate(@PathVariable long id, @RequestBody LocationInput input) {
        validateLocation(input.latitude(), input.longitude());
        require(input.latitude() != null, "Choose a map location.");
        return addToSpot(db.sql("""
            update studyspot.spots set latitude = :latitude, longitude = :longitude
            where id = :id returning id
            """).param("id", id).param("latitude", input.latitude()).param("longitude", input.longitude()));
    }

    private static void validateLocation(Double latitude, Double longitude) {
        boolean absent = latitude == null && longitude == null;
        boolean valid = latitude != null && longitude != null
            && Double.isFinite(latitude) && Double.isFinite(longitude)
            && latitude >= -85.05112878 && latitude <= 85.05112878
            && longitude >= -180 && longitude <= 180;
        require(absent || valid, "Choose valid map coordinates.");
    }

    @PostMapping("/{id}/ratings")
    @ResponseStatus(HttpStatus.CREATED)
    public Created rate(@PathVariable long id, @RequestBody RatingInput input) {
        var scores = input.scores();
        require(scores != null && scores.size() == 6
            && scores.stream().allMatch(score -> score != null && score >= 1 && score <= 5),
            "Give all six categories a score from 1 to 5.");
        String review = clean(input.review(), 1000, false);
        return addToSpot(db.sql("""
            insert into studyspot.ratings (spot_id, scores, review)
            select id, string_to_array(:scores, ',')::smallint[], :review
            from studyspot.spots where id = :id returning studyspot.ratings.id
            """).param("id", id).param("review", review)
            .param("scores", String.join(",", scores.stream().map(String::valueOf).toList())));
    }

    @PostMapping("/{id}/reports")
    @ResponseStatus(HttpStatus.CREATED)
    public Created report(@PathVariable long id, @RequestBody ReportInput input) {
        require(input.category() != null && ISSUES.contains(input.category()), "Choose a report category.");
        return addToSpot(db.sql("""
            insert into studyspot.reports (spot_id, category, details)
            select id, :category, :details from studyspot.spots where id = :id
            returning studyspot.reports.id
            """).param("id", id).param("category", input.category())
            .param("details", clean(input.details(), 1000, true)));
    }

    private static Created addToSpot(JdbcClient.StatementSpec statement) {
        return statement.query(Long.class).optional().map(Created::new)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Study spot not found."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public java.util.Map<String, String> invalidRecord() {
        return java.util.Map.of("message", "The data could not be saved. Check your input and try again.");
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<java.util.Map<String, String>> invalidRequest(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode())
            .body(java.util.Map.of("message", error.getReason()));
    }

    private static String clean(String value, int limit, boolean required) {
        String result = value == null ? "" : value.strip();
        require(!required || !result.isEmpty(), "Fill in the required text field.");
        require(result.length() <= limit, "Use " + limit + " characters or fewer.");
        return result;
    }

    private static void require(boolean valid, String message) {
        if (!valid) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
